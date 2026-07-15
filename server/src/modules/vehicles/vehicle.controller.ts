import type { Request, Response } from "express";
import { createVehicleSchema, updateVehicleSchema, vehicleIdParamsSchema } from "./vehicle.schema";
import { createVehicle, getVehicles, updateVehicle } from "./vehicle.service";

export async function listVehicles(_req: Request, res: Response) {
    res.json(await getVehicles());
}

export async function createVehicleHandler(req: Request, res: Response) {
    const input = createVehicleSchema.parse(req.body);
    res.status(201).json(await createVehicle(input));
}

export async function updateVehicleHandler(req: Request, res: Response) {
    const { id } = vehicleIdParamsSchema.parse(req.params);
    const input = updateVehicleSchema.parse(req.body);
    res.json(await updateVehicle(id, input));
}
