import type { Request, Response } from "express";
import { updatePricingSchema, vehicleTypeParamsSchema } from "./pricing.schema.js";
import { getRateCards, updateRateCard } from "./pricing.service.js";

export async function listRateCards(_req: Request, res: Response) {
    res.json(await getRateCards());
}

export async function updateRateCardHandler(req: Request, res: Response) {
    const { vehicleType } = vehicleTypeParamsSchema.parse(req.params);
    const input = updatePricingSchema.parse(req.body);
    res.json(await updateRateCard(vehicleType, input));
}
