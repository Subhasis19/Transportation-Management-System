import type { Request, Response } from "express";
import {
    adminVehicleQuerySchema,
    createVehicleSchema,
    updateVehicleSchema,
    updateVehicleStatusSchema,
    vehicleIdParamsSchema,
} from "./vehicle.schema.js";
import {
    createVehicle,
    getVehicles,
    updateVehicle,
    updateVehicleStatus,
} from "./vehicle.service.js";

export async function listVehicles(req: Request, res: Response) {
    res.json(await getVehicles(adminVehicleQuerySchema.parse(req.query)));
}

export async function createVehicleHandler(req: Request, res: Response) {
    res.status(201).json(await createVehicle(createVehicleSchema.parse(req.body)));
}

export async function updateVehicleHandler(req: Request, res: Response) {
    const { vehicleId } = vehicleIdParamsSchema.parse(req.params);
    res.json(await updateVehicle(vehicleId, updateVehicleSchema.parse(req.body)));
}

export async function updateVehicleStatusHandler(req: Request, res: Response) {
    const { vehicleId } = vehicleIdParamsSchema.parse(req.params);
    res.json(
        await updateVehicleStatus(
            vehicleId,
            updateVehicleStatusSchema.parse(req.body),
        ),
    );
}
