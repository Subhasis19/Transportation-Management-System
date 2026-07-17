import type { Request, Response } from "express";
import { adminLocationQuerySchema, createLocationSchema, locationParamsSchema, updateLocationSchema, updateLocationStatusSchema } from "./location.schema";
import { createLocation, getActiveLocations, getAdminLocations, updateLocation, updateLocationStatus } from "./location.service";

export async function listLocations(_req: Request, res: Response) {
    res.json(await getActiveLocations());
}

export async function createLocationHandler(req: Request, res: Response) {
    const input = createLocationSchema.parse(req.body);
    res.status(201).json(await createLocation(input));
}

export async function listAdminLocations(req: Request, res: Response) {
  res.json(await getAdminLocations(adminLocationQuerySchema.parse(req.query)));
}

export async function updateLocationHandler(req: Request, res: Response) {
  const { locationId } = locationParamsSchema.parse(req.params);
  res.json(await updateLocation(locationId, updateLocationSchema.parse(req.body)));
}

export async function updateLocationStatusHandler(req: Request, res: Response) {
  const { locationId } = locationParamsSchema.parse(req.params);
  res.json(await updateLocationStatus(locationId, updateLocationStatusSchema.parse(req.body)));
}
