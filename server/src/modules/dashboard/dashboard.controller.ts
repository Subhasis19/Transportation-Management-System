import type { Request, Response } from "express";
import { getDashboardData } from "./dashboard.service";

export async function getDashboard(_req: Request, res: Response) {
    res.json(await getDashboardData());
}
