import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { Role } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import { AppError } from "../common/errors/app-error.js";
import { z } from "zod";
import { findMatchingRefreshToken } from "./refresh-token-match.js";

const accessSecret = env.JWT_ACCESS_SECRET;
const refreshSecret = env.JWT_REFRESH_SECRET;
const revokedAccessUsers = new Set<string>();

export type AuthUser = { id: string; role: Role; email: string };
export type AuthRequest = Request & { user?: AuthUser };

export function setUserAccessRevoked(userId: string, revoked: boolean) {
  if (revoked) {
    revokedAccessUsers.add(userId);
    return;
  }
  revokedAccessUsers.delete(userId);
}

const accessTokenPayloadSchema = z.object({
  id: z.string().min(1),
  role: z.nativeEnum(Role),
  email: z.string().email(),
});

const refreshTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  jti: z.string().uuid(),
});

type RefreshTokenPayload = z.infer<typeof refreshTokenPayloadSchema>;

export function signAccessToken(user: AuthUser) {
  return jwt.sign(user, accessSecret, { expiresIn: "15m", algorithm: "HS256" });
}

function createRefreshToken(userId: string) {
  const id = randomUUID();
  return {
    id,
    raw: jwt.sign(
      { sub: userId, jti: id },
      refreshSecret,
      { expiresIn: "7d", algorithm: "HS256" },
    ),
  };
}

export function verifyRefreshToken(raw: string): RefreshTokenPayload {
  try {
    return refreshTokenPayloadSchema.parse(
      jwt.verify(raw, refreshSecret, { algorithms: ["HS256"] }),
    );
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }
}

export async function issueRefreshToken(userId: string) {
  const token = createRefreshToken(userId);
  await prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lte: new Date() } },
  });
  await prisma.refreshToken.create({
    data: {
      id: token.id,
      userId,
      tokenHash: await bcrypt.hash(token.raw, 12),
      expiresAt: new Date(Date.now() + 7 * 86400_000),
    },
  });
  return token.raw;
}

export async function rotateRefreshToken(raw: string) {
  const payload = verifyRefreshToken(raw);
  const now = new Date();

  await prisma.refreshToken.deleteMany({
    where: { userId: payload.sub, expiresAt: { lte: now } },
  });
  const match = await findMatchingRefreshToken(
    raw,
    {
      findById: () =>
        prisma.refreshToken.findFirst({
          where: { id: payload.jti, userId: payload.sub, expiresAt: { gt: now } },
          include: { user: true },
        }),
      findLegacy: () =>
        prisma.refreshToken.findMany({
          where: { userId: payload.sub, expiresAt: { gt: now } },
          include: { user: true },
          orderBy: { createdAt: "desc" },
        }),
    },
    bcrypt.compare,
  );
  if (!match || !match.user.isActive)
    throw new AppError(401, "Invalid refresh token");

  const nextToken = createRefreshToken(match.userId);
  const nextTokenHash = await bcrypt.hash(nextToken.raw, 12);
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.refreshToken.deleteMany({
      where: {
        id: match.id,
        userId: payload.sub,
        user: { isActive: true },
      },
    });
    if (deleted.count !== 1) throw new AppError(401, "Invalid refresh token");

    await tx.refreshToken.create({
      data: {
        id: nextToken.id,
        userId: match.userId,
        tokenHash: nextTokenHash,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      },
    });
    const user = match.user;
    return {
      accessToken: signAccessToken({ id: user.id, role: user.role, email: user.email }),
      refreshToken: nextToken.raw,
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
    if (revokedAccessUsers.has(req.user.id)) {
      return res.status(401).json({ message: "Invalid or expired access token" });
    }
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
