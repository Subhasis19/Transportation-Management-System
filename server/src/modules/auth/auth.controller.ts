import type { Response } from "express";
import type { AuthRequest } from "../../lib/auth.js";
import {
    loginSchema,
    refreshTokenSchema,
    registerSchema,
} from "./auth.schema.js";
import {
    loginUser,
    logoutUser,
    refreshAuthentication,
    registerUser,
} from "./auth.service.js";

export async function register(req: AuthRequest, res: Response) {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
}

export async function login(req: AuthRequest, res: Response) {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.json(result);
}

export async function refresh(req: AuthRequest, res: Response) {
    const input = refreshTokenSchema.parse(req.body);
    const result = await refreshAuthentication(input);
    res.json(result);
}

export async function logout(req: AuthRequest, res: Response) {
    const input = refreshTokenSchema.parse(req.body);
    await logoutUser(req.user!.id, input);
    res.status(204).send();
}
