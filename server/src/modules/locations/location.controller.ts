import type { Request, Response } from "express";
import { createLocationSchema } from "./location.schema";
import { createLocation, getLocations } from "./location.service";

export async function listLocations(_req: Request, res: Response) {
    res.json(await getLocations());
}

export async function createLocationHandler(req: Request, res: Response) {
    const input = createLocationSchema.parse(req.body);
    res.status(201).json(await createLocation(input));
}
