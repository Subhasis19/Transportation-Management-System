import "../test/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import { uploadGeneratedBookingDocument } from "./documents";

test("generated booking documents explicitly enable upsert", async () => {
  const calls: Array<{ path: string; upsert: boolean | undefined }> = [];
  const upload = async (
    path: string,
    _contents: Buffer,
    options: { upsert?: boolean } = {},
  ) => {
    calls.push({ path, upsert: options.upsert });
    return path;
  };

  await uploadGeneratedBookingDocument("lr/booking-123.pdf", Buffer.from("lr"), upload);
  await uploadGeneratedBookingDocument("invoices/booking-123.pdf", Buffer.from("invoice"), upload);

  assert.deepEqual(calls, [
    { path: "lr/booking-123.pdf", upsert: true },
    { path: "invoices/booking-123.pdf", upsert: true },
  ]);
});
