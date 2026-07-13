import PDFDocument from "pdfkit";
import type { Booking } from "../generated/prisma/client";
import { uploadPrivatePdf } from "../lib/storage";

function renderPdf(title: string, rows: Array<[string, string]>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(20).text("FleetFlow TMS", { align: "center" });
    doc.moveDown().fontSize(16).text(title).moveDown();
    rows.forEach(([label, value]) => doc.fontSize(10).fillColor("#475569").text(label).fillColor("#0f172a").fontSize(12).text(value).moveDown(0.5));
    doc.end();
  });
}

export async function createLorryReceipt(booking: Booking, vehicleReg: string) {
  const pdf = await renderPdf("Lorry Receipt", [["LR Number", booking.lrNumber || "Pending"], ["Booking", booking.id], ["Vehicle", vehicleReg], ["Consignor", booking.consignorName], ["Consignee", booking.consigneeName], ["Material", booking.materialDescription], ["Weight", `${booking.weightKg} kg`], ["Distance", `${booking.distanceKm} km`]]);
  return uploadPrivatePdf(`lr/${booking.id}.pdf`, pdf);
}

export async function createInvoice(booking: Booking) {
  const pdf = await renderPdf("Tax Invoice", [["Invoice Number", booking.invoiceNumber || "Pending"], ["Booking", booking.id], ["Base fare", `INR ${booking.baseFare}`], ["Distance charge", `INR ${booking.distanceCharge}`], ["Toll", `INR ${booking.tollAmount}`], ["GST", `INR ${booking.gstAmount}`], ["Total", `INR ${booking.estimatedFare}`]]);
  return uploadPrivatePdf(`invoices/${booking.id}.pdf`, pdf);
}
