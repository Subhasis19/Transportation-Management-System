import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { Role } from "../generated/prisma/client";
import { prisma } from "./prisma";
import { AppError } from "../common/errors/app-error";
import { z } from "zod";

const accessSecret = env.JWT_ACCESS_SECRET;
const refreshSecret = env.JWT_REFRESH_SECRET;

export type AuthUser = { id: string; role: Role; email: string };
export type AuthRequest = Request & { user?: AuthUser };

const accessTokenPayloadSchema = z.object({
  id: z.string().min(1),
  role: z.nativeEnum(Role),
  email: z.string().email(),
});

const refreshTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  jti: z.string().uuid(),
});

export function signAccessToken(user: AuthUser) {
  return jwt.sign(user, accessSecret, { expiresIn: "15m", algorithm: "HS256" });
}

export async function issueRefreshToken(userId: string) {
  const raw = jwt.sign(
    { sub: userId, jti: randomUUID() },
    refreshSecret,
    { expiresIn: "7d", algorithm: "HS256" },
  );
  await prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lte: new Date() } },
  });
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: await bcrypt.hash(raw, 12),
      expiresAt: new Date(Date.now() + 7 * 86400_000),
    },
  });
  return raw;
}

export async function rotateRefreshToken(raw: string) {
  let payload: z.infer<typeof refreshTokenPayloadSchema>;
  try {
    payload = refreshTokenPayloadSchema.parse(
      jwt.verify(raw, refreshSecret, { algorithms: ["HS256"] }),
    );
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({
      where: { userId: payload.sub, expiresAt: { lte: new Date() } },
    });
    const candidates = await tx.refreshToken.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    const match = await Promise.all(
      candidates.map(async (token) => ({
        token,
        valid: await bcrypt.compare(raw, token.tokenHash),
      })),
    ).then((items) => items.find((item) => item.valid));
    if (!match || !match.token.user.isActive)
      throw new AppError(401, "Invalid refresh token");

    const deleted = await tx.refreshToken.deleteMany({
      where: { id: match.token.id },
    });
    if (deleted.count !== 1) throw new AppError(401, "Invalid refresh token");

    const refreshToken = jwt.sign(
      { sub: match.token.userId, jti: randomUUID() },
      refreshSecret,
      { expiresIn: "7d", algorithm: "HS256" },
    );
    await tx.refreshToken.create({
      data: {
        userId: match.token.userId,
        tokenHash: await bcrypt.hash(refreshToken, 12),
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      },
    });
    const user = match.token.user;
    return {
      accessToken: signAccessToken({ id: user.id, role: user.role, email: user.email }),
      refreshToken,
    };
  });
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = accessTokenPayloadSchema.parse(
      jwt.verify(token, accessSecret, { algorithms: ["HS256"] }),
    );
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

export function allow(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res
        .status(403)
        .json({ message: "You do not have permission for this action" });
    next();
  };
}
