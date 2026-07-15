import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";

import { env } from "./config/env";

import {
  BookingStatus,
  Role,
  VehicleStatus
} from "./generated/prisma/client";

import { positiveMoneySchema, uuidSchema } from "./common/schemas/common.schema";

import { asyncHandler } from "./middleware/async-handler";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";

import { allow, authenticate } from "./lib/auth";

import { prisma } from "./lib/prisma";
import { signedDocumentUrl } from "./lib/storage";
import { authRouter } from "./modules/auth/auth.routes";
import {
  locationRouter,
  adminLocationRouter,
} from "./modules/locations/location.routes";
import {
  quoteRouter,
  adminRouteRouter,
} from "./modules/routes/route.routes";
import { adminVehicleRouter } from "./modules/vehicles/vehicle.routes";
import { adminPricingRouter } from "./modules/pricing/pricing.routes";
import { adminDriverRouter } from "./modules/drivers/driver.routes";
import { adminDashboardRouter } from "./modules/dashboard/dashboard.routes";

import {
  createInvoice,
  createLorryReceipt
} from "./services/documents";


import { calculateFare } from "./services/fare";

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/auth", authRouter);
app.use("/locations", locationRouter);
app.use("/quotes", quoteRouter);
app.use("/admin/locations", adminLocationRouter);
app.use("/admin/routes", adminRouteRouter);
app.use("/admin/vehicles", adminVehicleRouter);
app.use("/admin/rate-cards", adminPricingRouter);
app.use("/admin/drivers", adminDriverRouter);
app.use("/admin/dashboard", adminDashboardRouter);

const isCompliant = (vehicle: { rcExpiry: Date; permitExpiry: Date }) =>
  vehicle.rcExpiry > new Date() && vehicle.permitExpiry > new Date();
const bookingInclude = {
  customer: { select: { id: true, name: true, email: true } },
  driver: { select: { id: true, name: true } },
  vehicle: true,
  fromLocation: true,
  toLocation: true,
} as const;

app.get("/health", (_req, res) =>
  res.json({ success: true, message: "TruckLine API is running" }),
);

app.post(
  "/bookings",
  authenticate,
  allow(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        vehicleId: uuidSchema,
        fromLocationId: uuidSchema,
        toLocationId: uuidSchema,
        pickupAt: z.coerce
          .date()
          .refine((date) => date > new Date(), "Pickup must be in the future"),
        viaRoute: z.string().trim().max(255).optional(),
        consignorName: z.string().trim().min(2).max(150),
        consigneeName: z.string().trim().min(2).max(150),
        materialDescription: z.string().trim().min(2).max(255),
        weightKg: positiveMoneySchema,
        declaredValue: positiveMoneySchema,
      })
      .parse(req.body);
    const booking = await prisma.$transaction(async (tx) => {
      const route = await tx.route.findUnique({
        where: {
          fromLocationId_toLocationId: {
            fromLocationId: input.fromLocationId,
            toLocationId: input.toLocationId,
          },
        },
      });
      const vehicle = await tx.vehicle.findUnique({
        where: { id: input.vehicleId },
        include: { rateCard: true },
      });
      if (!route) throw new Error("This route is not configured yet");
      if (
        !vehicle ||
        vehicle.status !== VehicleStatus.AVAILABLE ||
        !isCompliant(vehicle)
      )
        throw new Error("This vehicle is no longer available or compliant");
      const reserved = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: VehicleStatus.AVAILABLE },
        data: { status: VehicleStatus.RESERVED },
      });
      if (reserved.count !== 1)
        throw new Error("This vehicle was just reserved by another booking");
      const fare = calculateFare({
        distanceKm: Number(route.distanceKm),
        tollAmount: Number(route.tollAmount),
        baseFare: Number(vehicle.rateCard.baseFare),
        perKmRate: Number(vehicle.rateCard.perKmRate),
        gstPercent: Number(vehicle.rateCard.gstPercent),
      });
      return tx.booking.create({
        data: {
          ...input,
          customerId: req.user!.id,
          distanceKm: fare.distanceKm,
          baseFare: fare.baseFare,
          distanceCharge: fare.distanceCharge,
          tollAmount: fare.tollAmount,
          gstPercent: fare.gstPercent,
          gstAmount: fare.gstAmount,
          estimatedFare: fare.total,
        },
        include: bookingInclude,
      });
    });
    res.status(201).json(booking);
  }),
);

app.get(
  "/bookings/mine",
  authenticate,
  asyncHandler(async (req, res) => {
    const where =
      req.user!.role === Role.CUSTOMER
        ? { customerId: req.user!.id }
        : req.user!.role === Role.DRIVER
          ? { driverId: req.user!.id }
          : {};
    res.json(
      await prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);

app.post(
  "/admin/bookings/:id/confirm",
  authenticate,
  allow(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const bookingId = uuidSchema.parse(req.params.id);
    const { driverId } = z
      .object({
        driverId: uuidSchema,
      })
      .parse(req.body);
    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { vehicle: true },
      });
      const driver = await tx.user.findUnique({ where: { id: driverId } });
      if (!current || current.status !== BookingStatus.PENDING)
        throw new Error("Only pending bookings can be confirmed");
      if (
        !driver ||
        driver.role !== Role.DRIVER ||
        !driver.licenseExpiry ||
        driver.licenseExpiry <= new Date() ||
        !isCompliant(current.vehicle)
      )
        throw new Error("Vehicle or assigned driver is not compliant");
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          driverId,
          lrNumber: `LR-${current.id.slice(-8).toUpperCase()}`,
          lrGeneratedAt: new Date(),
        },
      });
    });
    const complete = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { vehicle: true },
    });
    const lrPdfUrl = await createLorryReceipt(
      complete,
      complete.vehicle.regNumber,
    );
    res.json(
      await prisma.booking.update({
        where: { id: booking.id },
        data: { lrPdfUrl },
      }),
    );
  }),
);

app.post(
  "/admin/bookings/:id/depart",
  authenticate,
  allow(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const bookingId = uuidSchema.parse(req.params.id);
    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!current || current.status !== BookingStatus.CONFIRMED)
        throw new Error("Only confirmed bookings can depart");
      await tx.vehicle.update({
        where: { id: current.vehicleId },
        data: { status: VehicleStatus.ON_TRIP },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.IN_TRANSIT },
      });
    });
    res.json(booking);
  }),
);

app.post(
  "/driver/bookings/:id/deliver",
  authenticate,
  allow(Role.DRIVER),
  asyncHandler(async (req, res) => {
    const bookingId = uuidSchema.parse(req.params.id);
    const { notes } = z
      .object({ notes: z.string().trim().min(3).max(2000) })
      .parse(req.body);
    const delivered = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        driverId: req.user!.id,
        status: BookingStatus.IN_TRANSIT,
      },
      data: {
        status: BookingStatus.INVOICED,
        deliveryNotes: notes,
        deliveryTime: new Date(),
        invoiceNumber: `INV-${bookingId.slice(-8).toUpperCase()}`,
        invoiceGeneratedAt: new Date(),
      },
    });
    if (delivered.count !== 1) {
      res
        .status(409)
        .json({ message: "This trip is not available for delivery" });
      return;
    }
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    const invoicePdfUrl = await createInvoice(booking);
    res.json(
      await prisma.booking.update({
        where: { id: bookingId },
        data: { invoicePdfUrl },
      }),
    );
  }),
);

app.post(
  "/admin/bookings/:id/close",
  authenticate,
  allow(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const bookingId = uuidSchema.parse(req.params.id);
    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!current || current.status !== BookingStatus.INVOICED)
        throw new Error("Only invoiced trips can be closed");
      await tx.vehicle.update({
        where: { id: current.vehicleId },
        data: { status: VehicleStatus.AVAILABLE },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CLOSED },
      });
    });
    res.json(booking);
  }),
);

app.post(
  "/admin/bookings/:id/cancel",
  authenticate,
  allow(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const bookingId = uuidSchema.parse(req.params.id);
    const { reason } = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .parse(req.body);
    const booking = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: bookingId } });
      if (
        !current ||
        !(
          [BookingStatus.PENDING, BookingStatus.CONFIRMED] as BookingStatus[]
        ).includes(current.status)
      )
        throw new Error("Only pending or confirmed bookings can be cancelled");
      await tx.vehicle.update({
        where: { id: current.vehicleId },
        data: { status: VehicleStatus.AVAILABLE },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      });
    });
    res.json(booking);
  }),
);

app.get(
  "/bookings/:id/documents/:kind",
  authenticate,
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: uuidSchema.parse(req.params.id) },
    });
    if (
      !booking ||
      (![booking.customerId, booking.driverId].includes(req.user!.id) &&
        req.user!.role !== Role.ADMIN)
    ) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    const path =
      req.params.kind === "lr"
        ? booking.lrPdfUrl
        : req.params.kind === "invoice"
          ? booking.invoicePdfUrl
          : null;
    if (!path) {
      res.status(404).json({ message: "Document is not available" });
      return;
    }
    res.json({ url: await signedDocumentUrl(path) });
  }),
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
