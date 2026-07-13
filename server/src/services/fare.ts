export type FareInput = { distanceKm: number; tollAmount: number; baseFare: number; perKmRate: number; gstPercent: number };
export type FareBreakdown = { distanceKm: number; baseFare: number; distanceCharge: number; tollAmount: number; gstPercent: number; gstAmount: number; total: number };

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateFare(input: FareInput): FareBreakdown {
  const distanceCharge = money(input.distanceKm * input.perKmRate);
  const subtotal = money(input.baseFare + distanceCharge + input.tollAmount);
  const gstAmount = money(subtotal * (input.gstPercent / 100));
  return { distanceKm: input.distanceKm, baseFare: money(input.baseFare), distanceCharge, tollAmount: money(input.tollAmount), gstPercent: input.gstPercent, gstAmount, total: money(subtotal + gstAmount) };
}
