import type { Request, Response } from "express";
import { quoteQuerySchema, createRouteSchema } from "./route.schema";
import { getAdminRoutes, getQuote, upsertRoute } from "./route.service";

export async function getQuoteHandler(req: Request, res: Response) {
    const input = quoteQuerySchema.parse(req.query);
    res.json(await getQuote(input));
}

export async function listAdminRoutes(_req: Request, res: Response) {
    res.json(await getAdminRoutes());
}

export async function createOrUpdateRoute(req: Request, res: Response) {
    const input = createRouteSchema.parse(req.body);
    res.status(201).json(await upsertRoute(input));
}
