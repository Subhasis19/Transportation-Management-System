import "../../test/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../common/errors/app-error";
import { BookingStatus } from "../../generated/prisma/client";
import {
  confirmationCompensation,
  invoiceCompensation,
  retryConfirmationTransaction,
} from "./booking-lifecycle.service";

test("LR compensation clears confirmation-only fields", () => {
  assert.deepEqual(confirmationCompensation("booking-123"), {
    where: {
      id: "booking-123",
      status: BookingStatus.CONFIRMED,
      lrPdfUrl: null,
    },
    data: {
      status: BookingStatus.PENDING,
      driverId: null,
      lrNumber: null,
      lrGeneratedAt: null,
      lrPdfUrl: null,
    },
  });
});

test("invoice compensation clears invoice and delivery fields", () => {
  assert.deepEqual(invoiceCompensation("booking-123"), {
    where: {
      id: "booking-123",
      status: BookingStatus.INVOICED,
      invoicePdfUrl: null,
    },
    data: {
      status: BookingStatus.IN_TRANSIT,
      invoiceNumber: null,
      invoiceGeneratedAt: null,
      invoicePdfUrl: null,
      deliveryNotes: null,
      deliveryTime: null,
    },
  });
});

test("confirmation transaction conflict retry stops after three attempts", async () => {
  let attempts = 0;

  await assert.rejects(
    retryConfirmationTransaction(async () => {
      attempts += 1;
      throw { code: "P2034" };
    }),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.message === "Booking confirmation conflict; please try again",
  );

  assert.equal(attempts, 3);
});
