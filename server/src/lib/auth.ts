import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "./prisma";

const legacySecret = process.env.JWT_SECRET;
const accessSecret = process.env.JWT_ACCESS_SECRET || legacySecret || "development-access-secret-change-me";
const refreshSecret = process.env.JWT_REFRESH_SECRET || legacySecret || "development-refresh-secret-change-me";

export type AuthUser = { id: string; role: Role; email: string };
export type AuthRequest = Request & { user?: AuthUser };

export function signAccessToken(user: AuthUser) {
  return jwt.sign(user, accessSecret, { expiresIn: "15m" });
}

export async function issueRefreshToken(userId: string) {
  const raw = jwt.sign({ sub: userId, jti: randomUUID() }, refreshSecret, { expiresIn: "7d" });
  await prisma.refreshToken.create({
    data: { userId, tokenHash: await bcrypt.hash(raw, 12), expiresAt: new Date(Date.now() + 7 * 86400_000) },
  });
  return raw;
}

export async function rotateRefreshToken(raw: string) {
  const payload = jwt.verify(raw, refreshSecret) as jwt.JwtPayload;
  if (!payload.sub) throw new Error("Invalid refresh token");
  const candidates = await prisma.refreshToken.findMany({
    where: { userId: payload.sub, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  const match = await Promise.all(candidates.map(async (token) => ({ token, valid: await bcrypt.compare(raw, token.tokenHash) }))).then((x) => x.find((x) => x.valid));
  if (!match || !match.token.user.isActive) throw new Error("Invalid refresh token");
  await prisma.refreshToken.delete({ where: { id: match.token.id } });
  const user = match.token.user;
  return { accessToken: signAccessToken({ id: user.id, role: user.role, email: user.email }), refreshToken: await issueRefreshToken(user.id) };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = jwt.verify(token, accessSecret) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

export function allow(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "You do not have permission for this action" });
    next();
  };
}
