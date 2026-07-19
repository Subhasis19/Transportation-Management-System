import "../../test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../common/errors/app-error.js";
import { BookingStatus } from "../../generated/prisma/client.js";
import {
  confirmationCompensation,
  invoiceCompensation,
  retryConfirmationTransaction,
  retryLifecycleTransaction,
} from "./booking-lifecycle.service.js";

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

test("generic lifecycle conflict retry stops after three attempts", async () => {
  let attempts = 0;
  await assert.rejects(
    retryLifecycleTransaction(async () => {
      attempts += 1;
      throw { code: "P2034" };
    }),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.message === "Booking lifecycle conflict; please try again",
  );
  assert.equal(attempts, 3);
});

test("compensation predicates cannot overwrite a cancelled booking", () => {
  const predicate = confirmationCompensation("booking-123").where;
  assert.equal(predicate.status, BookingStatus.CONFIRMED);
  assert.equal(predicate.lrPdfUrl, null);
});
