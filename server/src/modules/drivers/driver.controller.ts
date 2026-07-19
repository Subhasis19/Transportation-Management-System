import type { Request, Response } from "express";
import {
    adminDriverQuerySchema,
    createDriverSchema,
    driverIdParamsSchema,
    updateDriverSchema,
    updateDriverStatusSchema,
} from "./driver.schema.js";
import {
    createDriver,
    getDriverOptions,
    getDrivers,
    updateDriver,
    updateDriverStatus,
} from "./driver.service.js";

export async function listDrivers(req: Request, res: Response) {
    res.json(await getDrivers(adminDriverQuerySchema.parse(req.query)));
}

export async function listDriverOptions(_req: Request, res: Response) {
    res.json(await getDriverOptions());
}

export async function createDriverHandler(req: Request, res: Response) {
    res.status(201).json(await createDriver(createDriverSchema.parse(req.body)));
}

export async function updateDriverHandler(req: Request, res: Response) {
    const { driverId } = driverIdParamsSchema.parse(req.params);
    res.json(await updateDriver(driverId, updateDriverSchema.parse(req.body)));
}

export async function updateDriverStatusHandler(req: Request, res: Response) {
    const { driverId } = driverIdParamsSchema.parse(req.params);
    res.json(
        await updateDriverStatus(
            driverId,
            updateDriverStatusSchema.parse(req.body),
        ),
    );
}
