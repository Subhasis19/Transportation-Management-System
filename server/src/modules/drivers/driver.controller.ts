import type { Request, Response } from "express";
import { getActiveDrivers } from "./driver.service";

export async function listDrivers(_req: Request, res: Response) {
    res.json(await getActiveDrivers());
}
