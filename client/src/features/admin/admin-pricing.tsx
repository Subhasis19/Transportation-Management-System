import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ApiRequest } from "@/lib/api-client";
import type { AdminRateCard, Report, VehicleType } from "@/types/domain";

type AdminPricingProps = { request: ApiRequest; report: Report };
type PricingForm = {
  rateCard: AdminRateCard;
  baseFare: string;
  perKmRate: string;
  gstPercent: string;
};

const vehicleTypeLabels: Record<VehicleType, string> = {
  MINI_TRUCK: "Mini Truck",
  LIGHT_TRUCK: "Light Truck",
  MEDIUM_TRUCK: "Medium Truck",
  HEAVY_TRUCK: "Heavy Truck",
};

const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete the pricing action";

const validNumber = (value: string, minimum: number, maximum: number) => {
  if (value.trim() === "") return false;
  const number = Number(value);
  const scaled = number * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;

  return (
    Number.isFinite(number) &&
    number >= minimum &&
    number <= maximum &&
    Math.abs(scaled - Math.round(scaled)) <= tolerance
  );
};

export function AdminPricing({ request, report }: AdminPricingProps) {
  const [rateCards, setRateCards] = useState<AdminRateCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<PricingForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sampleDistance, setSampleDistance] = useState("100");
  const [sampleToll, setSampleToll] = useState("0");
  const mounted = useRef(true);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      requestId.current += 1;
      controller.current?.abort();
    };
  }, []);

  const loadRateCards = useCallback(async () => {
    if (!mounted.current) return;

    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError(null);

    try {
      const result = await request<AdminRateCard[]>("/admin/rate-cards", {
        signal: nextController.signal,
      });
      if (mounted.current && currentRequest === requestId.current) {
        setRateCards(result);
        setLoadError(null);
      }
    } catch (error) {
      if (
        mounted.current &&
        !nextController.signal.aborted &&
        currentRequest === requestId.current
      ) {
        setLoadError(errorMessage(error));
      }
    } finally {
      if (mounted.current && currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRateCards(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRateCards]);

  const openForm = (rateCard: AdminRateCard) => {
    if (saving) return;
    setForm({
      rateCard,
      baseFare: String(rateCard.baseFare),
      perKmRate: String(rateCard.perKmRate),
      gstPercent: String(rateCard.gstPercent),
    });
    setFormError(null);
  };

  const save = async () => {
    if (!form || saving) return;
    if (
      !validNumber(form.baseFare, 0, 99_999_999) ||
      !validNumber(form.perKmRate, 0, 99_999_999) ||
      !validNumber(form.gstPercent, 0, 100)
    ) {
      setFormError(
        "Enter non-negative amounts with at most two decimals. GST cannot exceed 100%.",
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await request<AdminRateCard>(
        `/admin/rate-cards/${form.rateCard.vehicleType}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            baseFare: Number(form.baseFare),
            perKmRate: Number(form.perKmRate),
            gstPercent: Number(form.gstPercent),
          }),
        },
      );
      if (!mounted.current) return;
      report("Pricing updated");
      setForm(null);
      await loadRateCards();
    } catch (error) {
      if (mounted.current) setFormError(errorMessage(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const previewIsValid =
    validNumber(sampleDistance, 0.01, 99_999_999) &&
    validNumber(sampleToll, 0, 99_999_999);
  const previewDistance = Number(sampleDistance);
  const previewToll = Number(sampleToll);
  const previewError = previewIsValid
    ? null
    : "Enter a distance greater than zero and a non-negative toll with at most two decimals.";

  return (
    <div className="space-y-6">
      <section>
        <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
          ADMIN CONTROL CENTRE
        </p>
        <h1 className="mt-2 text-3xl font-bold">Pricing Master</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage vehicle rate cards used for new quotes and bookings.
        </p>
        <p className="mt-2 text-sm text-amber-700">
          Pricing updates affect new quotes and bookings only. Existing bookings
          keep their original fare.
        </p>
      </section>

      {form && (
        <Card>
          <CardHeader>
            <CardTitle>
              Edit {vehicleTypeLabels[form.rateCard.vehicleType]} pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Base fare
              <input
                autoFocus
                className="h-9 rounded border px-3 font-normal"
                type="number"
                step="0.01"
                value={form.baseFare}
                aria-describedby={formError ? "pricing-form-error" : undefined}
                onChange={(event) =>
                  setForm({ ...form, baseFare: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Per-kilometre rate
              <input
                className="h-9 rounded border px-3 font-normal"
                type="number"
                step="0.01"
                value={form.perKmRate}
                aria-describedby={formError ? "pricing-form-error" : undefined}
                onChange={(event) =>
                  setForm({ ...form, perKmRate: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              GST percentage
              <input
                className="h-9 rounded border px-3 font-normal"
                type="number"
                step="0.01"
                value={form.gstPercent}
                aria-describedby={formError ? "pricing-form-error" : undefined}
                onChange={(event) =>
                  setForm({ ...form, gstPercent: event.target.value })
                }
              />
            </label>
            {formError && (
              <p id="pricing-form-error" aria-live="polite" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <Button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save pricing"}
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setForm(null)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rate cards</CardTitle>
          <CardDescription>
            Current rates are applied when the server creates a new quote or booking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !rateCards ? (
            <p className="text-sm text-slate-500">Loading pricing…</p>
          ) : loadError && !rateCards ? (
            <div className="flex items-center gap-3 text-sm text-red-600">
              <p aria-live="polite">{loadError}</p>
              <Button variant="outline" onClick={() => void loadRateCards()}>
                Retry
              </Button>
            </div>
          ) : !rateCards || rateCards.length === 0 ? (
            <p className="text-sm text-slate-500">
              No rate cards have been configured.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rateCards.map((rateCard) => (
                <Card key={rateCard.id}>
                  <CardHeader className="pb-2">
                    <CardTitle>{vehicleTypeLabels[rateCard.vehicleType]}</CardTitle>
                    <CardDescription>
                      Last updated {new Date(rateCard.updatedAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>Base fare: {currency(rateCard.baseFare)}</p>
                    <p>Per kilometre: {currency(rateCard.perKmRate)}/km</p>
                    <p>GST: {rateCard.gstPercent}%</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => openForm(rateCard)}
                    >
                      Edit
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {loadError && rateCards && (
            <div className="mt-3 flex items-center gap-3 text-sm text-red-600">
              <p aria-live="polite">{loadError}</p>
              <Button variant="outline" onClick={() => void loadRateCards()}>
                Retry
              </Button>
            </div>
          )}
          {loading && rateCards && (
            <p className="mt-3 text-sm text-slate-500">Refreshing pricing…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample Fare Preview</CardTitle>
          <CardDescription>
            Preview only — final booking fare is calculated by the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Sample distance in kilometres
              <input
                className="h-9 rounded border px-3 font-normal"
                type="number"
                step="0.01"
                value={sampleDistance}
                onChange={(event) => setSampleDistance(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Sample toll amount
              <input
                className="h-9 rounded border px-3 font-normal"
                type="number"
                step="0.01"
                value={sampleToll}
                onChange={(event) => setSampleToll(event.target.value)}
              />
            </label>
          </div>
          {previewError && (
            <p aria-live="polite" className="text-sm text-red-600">
              {previewError}
            </p>
          )}
          {previewIsValid && rateCards && rateCards.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {rateCards.map((rateCard) => {
                const distanceCharge = money(previewDistance * rateCard.perKmRate);
                const subtotal = money(
                  rateCard.baseFare + distanceCharge + previewToll,
                );
                const gstAmount = money(subtotal * (rateCard.gstPercent / 100));
                const total = money(subtotal + gstAmount);

                return (
                  <div key={rateCard.id} className="rounded border p-4 text-sm">
                    <p className="font-medium">
                      {vehicleTypeLabels[rateCard.vehicleType]}
                    </p>
                    <p>Base fare: {currency(rateCard.baseFare)}</p>
                    <p>Distance charge: {currency(distanceCharge)}</p>
                    <p>Toll: {currency(previewToll)}</p>
                    <p>GST amount: {currency(gstAmount)}</p>
                    <p className="mt-2 font-semibold">Estimated total: {currency(total)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
