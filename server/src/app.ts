import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcrypt";
import { z } from "zod";
import { BookingStatus, Role, VehicleStatus } from "./generated/prisma/client";
import {
  allow,
  authenticate,
  issueRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type AuthRequest,
} from "./lib/auth";
import { prisma } from "./lib/prisma";
import { signedDocumentUrl } from "./lib/storage";
import { createInvoice, createLorryReceipt } from "./services/documents";
import { calculateFare } from "./services/fare";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

const vehicleTypes = [
  "MINI_TRUCK",
  "LIGHT_TRUCK",
  "MEDIUM_TRUCK",
  "HEAVY_TRUCK",
] as const;
const id = z.string().uuid();
const money = z.coerce.number().finite().min(0).max(99_999_999);
const asyncRoute =
  (handler: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req as AuthRequest, res).catch(next);
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
  res.json({ success: true, message: "FleetFlow API is running" }),
);

app.post(
  "/auth/register",
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().email(),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[0-9]{10,15}$/),
        password: z.string().min(8).max(72),
      })
      .parse(req.body);
    const user = await prisma.user.create({
      data: {
        ...input,
        email: input.email.toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, 12),
        role: Role.CUSTOMER,
      },
    });
    const authUser = { id: user.id, role: user.role, email: user.email };
    res
      .status(201)
      .json({
        user: { id: user.id, name: user.name, role: user.role },
        accessToken: signAccessToken(authUser),
        refreshToken: await issueRefreshToken(user.id),
      });
  }),
);

app.post(
  "/auth/login",
  asyncRoute(async (req, res) => {
    const input = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(input.password, user.passwordHash))
    ) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    res.json({
      user: { id: user.id, name: user.name, role: user.role },
      accessToken: signAccessToken({
        id: user.id,
        role: user.role,
        email: user.email,
      }),
      refreshToken: await issueRefreshToken(user.id),
    });
  }),
);

app.post(
  "/auth/refresh",
  asyncRoute(async (req, res) => {
    const refreshToken = z
      .object({ refreshToken: z.string().min(1) })
      .parse(req.body).refreshToken;
    res.json(await rotateRefreshToken(refreshToken));
  }),
);

app.post(
  "/auth/logout",
  authenticate,
  asyncRoute(async (req, res) => {
    const raw = z
      .object({ refreshToken: z.string().min(1) })
      .parse(req.body).refreshToken;
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: req.user!.id },
    });
    const found = await Promise.all(
      tokens.map(async (token) => ({
        token,
        matches: await bcrypt.compare(raw, token.tokenHash),
      })),
    ).then((x) => x.find((x) => x.matches));
    if (found)
      await prisma.refreshToken.delete({ where: { id: found.token.id } });
    res.status(204).send();
  }),
);

app.get(
  "/locations",
  authenticate,
  asyncRoute(async (_req, res) => {
    res.json(await prisma.location.findMany({ orderBy: { cityName: "asc" } }));
  }),
);

app.get(
  "/quotes",
  authenticate,
  asyncRoute(async (req, res) => {
    const query = z
      .object({ fromLocationId: id, toLocationId: id })
      .parse(req.query);
    if (query.fromLocationId === query.toLocationId) {
      res.status(400).json({ message: "Origin and destination must differ" });
      return;
    }
    const route = await prisma.route.findUnique({
      where: { fromLocationId_toLocationId: query },
    });
    if (!route) {
      res.status(404).json({ message: "This route is not configured yet" });
      return;
    }
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: VehicleStatus.AVAILABLE,
        rcExpiry: { gt: new Date() },
        permitExpiry: { gt: new Date() },
      },
      include: { rateCard: true },
      orderBy: { capacityKg: "asc" },
    });
    res.json({
      route: {
        ...route,
        distanceKm: Number(route.distanceKm),
        tollAmount: Number(route.tollAmount),
      },
      options: vehicles.map((vehicle) => ({
        vehicle: {
          id: vehicle.id,
          regNumber: vehicle.regNumber,
          vehicleType: vehicle.vehicleType,
          capacityKg: Number(vehicle.capacityKg),
        },
        fare: calculateFare({
          distanceKm: Number(route.distanceKm),
          tollAmount: Number(route.tollAmount),
          baseFare: Number(vehicle.rateCard.baseFare),
          perKmRate: Number(vehicle.rateCard.perKmRate),
          gstPercent: Number(vehicle.rateCard.gstPercent),
        }),
      })),
    });
  }),
);

app.post(
  "/bookings",
  authenticate,
  allow(Role.CUSTOMER),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        vehicleId: id,
        fromLocationId: id,
        toLocationId: id,
        pickupAt: z.coerce
          .date()
          .refine((date) => date > new Date(), "Pickup must be in the future"),
        viaRoute: z.string().trim().max(255).optional(),
        consignorName: z.string().trim().min(2).max(150),
        consigneeName: z.string().trim().min(2).max(150),
        materialDescription: z.string().trim().min(2).max(255),
        weightKg: money.positive(),
        declaredValue: money.positive(),
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
  asyncRoute(async (req, res) => {
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

app.get(
  "/admin/dashboard",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (_req, res) => {
    const [vehicles, bookings, revenue, expiringDocuments, recentBookings] =
      await Promise.all([
        prisma.vehicle.groupBy({ by: ["status"], _count: true }),
        prisma.booking.groupBy({ by: ["status"], _count: true }),
        prisma.booking.aggregate({
          where: {
            status: { in: [BookingStatus.INVOICED, BookingStatus.CLOSED] },
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { estimatedFare: true },
        }),
        prisma.vehicle.findMany({
          where: {
            OR: [
              { rcExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
              { permitExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
            ],
          },
          select: {
            id: true,
            regNumber: true,
            rcExpiry: true,
            permitExpiry: true,
          },
        }),
        prisma.booking.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          include: bookingInclude,
        }),
      ]);
    res.json({
      vehicles,
      bookings,
      revenueThisMonth: Number(revenue._sum.estimatedFare || 0),
      expiringDocuments,
      recentBookings,
    });
  }),
);

app.get(
  "/admin/drivers",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (_req, res) => {
    res.json(
      await prisma.user.findMany({
        where: { role: Role.DRIVER, isActive: true },
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          licenseExpiry: true,
        },
      }),
    );
  }),
);

app.post(
  "/admin/locations",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (req, res) => {
    const cityName = z
      .object({ cityName: z.string().trim().min(2).max(100) })
      .parse(req.body).cityName;
    res.status(201).json(await prisma.location.create({ data: { cityName } }));
  }),
);
app.get(
  "/admin/routes",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (_req, res) => {
    res.json(
      await prisma.route.findMany({
        include: { fromLocation: true, toLocation: true },
        orderBy: { fromLocation: { cityName: "asc" } },
      }),
    );
  }),
);
app.post(
  "/admin/routes",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        fromLocationId: id,
        toLocationId: id,
        distanceKm: z.coerce.number().positive().max(99_999),
        tollAmount: money,
      })
      .parse(req.body);
    if (input.fromLocationId === input.toLocationId) {
      res.status(400).json({ message: "Origin and destination must differ" });
      return;
    }
    res
      .status(201)
      .json(
        await prisma.route.upsert({
          where: {
            fromLocationId_toLocationId: {
              fromLocationId: input.fromLocationId,
              toLocationId: input.toLocationId,
            },
          },
          update: {
            distanceKm: input.distanceKm,
            tollAmount: input.tollAmount,
          },
          create: input,
        }),
      );
  }),
);

app.get(
  "/admin/vehicles",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (_req, res) => {
    res.json(
      await prisma.vehicle.findMany({
        include: { rateCard: true },
        orderBy: { regNumber: "asc" },
      }),
    );
  }),
);
app.post(
  "/admin/vehicles",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        regNumber: z.string().trim().min(4).max(20),
        vehicleType: z.enum(vehicleTypes),
        capacityKg: money.positive(),
        rcNumber: z.string().trim().min(3).max(50),
        rcExpiry: z.coerce.date(),
        permitNumber: z.string().trim().min(3).max(50),
        permitExpiry: z.coerce.date(),
      })
      .parse(req.body);
    res.status(201).json(await prisma.vehicle.create({ data: input }));
  }),
);
app.patch(
  "/admin/vehicles/:id",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        status: z.nativeEnum(VehicleStatus).optional(),
        rcExpiry: z.coerce.date().optional(),
        permitExpiry: z.coerce.date().optional(),
      })
      .parse(req.body);
    res.json(
      await prisma.vehicle.update({
        where: { id: id.parse(req.params.id) },
        data: input,
      }),
    );
  }),
);

app.get(
  "/admin/rate-cards",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (_req, res) => {
    res.json(
      await prisma.pricing.findMany({ orderBy: { vehicleType: "asc" } }),
    );
  }),
);
app.patch(
  "/admin/rate-cards/:vehicleType",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        baseFare: money,
        perKmRate: money,
        gstPercent: z.coerce.number().min(0).max(100),
      })
      .parse(req.body);
    res.json(
      await prisma.pricing.update({
        where: {
          vehicleType: z.enum(vehicleTypes).parse(req.params.vehicleType),
        },
        data: input,
      }),
    );
  }),
);

app.post(
  "/admin/bookings/:id/confirm",
  authenticate,
  allow(Role.ADMIN),
  asyncRoute(async (req, res) => {
    const bookingId = id.parse(req.params.id);
    const { driverId } = z.object({ driverId: id }).parse(req.body);
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
  asyncRoute(async (req, res) => {
    const bookingId = id.parse(req.params.id);
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
  asyncRoute(async (req, res) => {
    const bookingId = id.parse(req.params.id);
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
  asyncRoute(async (req, res) => {
    const bookingId = id.parse(req.params.id);
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
  asyncRoute(async (req, res) => {
    const bookingId = id.parse(req.params.id);
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
  asyncRoute(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: id.parse(req.params.id) },
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

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    res
      .status(400)
      .json({ message: "Validation failed", issues: error.issues });
    return;
  }
  if (error instanceof Error) {
    res
      .status(
        error.message.includes("no longer") || error.message.includes("Only ")
          ? 409
          : 400,
      )
      .json({ message: error.message });
    return;
  }
  res.status(500).json({ message: "Unexpected server error" });
});

export default app;
