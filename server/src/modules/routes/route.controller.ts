import type { Request, Response } from "express";
import {
    adminRouteQuerySchema,
    quoteQuerySchema,
    createRouteSchema,
    routeParamsSchema,
    updateRouteSchema,
    updateRouteStatusSchema,
} from "./route.schema.js";
import {
    createRoute,
    getAdminRoutes,
    getQuote,
    updateRoute,
    updateRouteStatus,
} from "./route.service.js";

export async function getQuoteHandler(req: Request, res: Response) {
    const input = quoteQuerySchema.parse(req.query);
    res.json(await getQuote(input));
}

export async function listAdminRoutes(req: Request, res: Response) {
    res.json(await getAdminRoutes(adminRouteQuerySchema.parse(req.query)));
}

export async function createRouteHandler(req: Request, res: Response) {
    const input = createRouteSchema.parse(req.body);
    res.status(201).json(await createRoute(input));
}
export async function updateRouteHandler(req: Request, res: Response) {
    const { routeId } = routeParamsSchema.parse(req.params);
    res.json(await updateRoute(routeId, updateRouteSchema.parse(req.body)));
}
export async function updateRouteStatusHandler(req: Request, res: Response) {
    const { routeId } = routeParamsSchema.parse(req.params);
    res.json(
        await updateRouteStatus(routeId, updateRouteStatusSchema.parse(req.body)),
    );
}
