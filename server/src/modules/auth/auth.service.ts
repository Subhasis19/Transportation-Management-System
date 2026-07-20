import bcrypt from "bcrypt";
import { AppError } from "../../common/errors/app-error.js";
import { Role } from "../../generated/prisma/client.js";
import {
    issueRefreshToken,
    rotateRefreshToken,
    signAccessToken,
    verifyRefreshToken,
} from "../../lib/auth.js";
import { findMatchingRefreshToken } from "../../lib/refresh-token-match.js";
import { prisma } from "../../lib/prisma.js";
import type { LoginInput, RegisterInput, RefreshTokenInput } from "./auth.schema.js";

export async function registerUser(input: RegisterInput) {
    const { password, ...profile } = input;
    const authenticatedAt = new Date();
    const user = await prisma.user.create({
        data: {
            ...profile,
            email: profile.email.toLowerCase(),
            passwordHash: await bcrypt.hash(password, 12),
            role: Role.CUSTOMER,
            lastLoginAt: authenticatedAt,
        },
    });

    const authUser = { id: user.id, role: user.role, email: user.email };

    return {
        user: { id: user.id, name: user.name, role: user.role },
        accessToken: signAccessToken(authUser),
        refreshToken: await issueRefreshToken(user.id),
    };
}

export async function loginUser(input: LoginInput) {
    const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
    });

    if (
        !user ||
        !user.isActive ||
        !(await bcrypt.compare(input.password, user.passwordHash))
    ) {
        throw new AppError(401, "Invalid email or password");
    }

    const authenticatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    return {
        user: {
            id: authenticatedUser.id,
            name: authenticatedUser.name,
            role: authenticatedUser.role,
        },
        accessToken: signAccessToken({
            id: authenticatedUser.id,
            role: authenticatedUser.role,
            email: authenticatedUser.email,
        }),
        refreshToken: await issueRefreshToken(authenticatedUser.id),
    };
}

export async function refreshAuthentication(input: RefreshTokenInput) {
    return rotateRefreshToken(input.refreshToken);
}

export async function logoutUser(userId: string, input: RefreshTokenInput) {
    let payload;
    try {
        payload = verifyRefreshToken(input.refreshToken);
    } catch {
        return;
    }
    if (payload.sub !== userId) return;

    const now = new Date();
    await prisma.refreshToken.deleteMany({
        where: { userId, expiresAt: { lte: now } },
    });
    const found = await findMatchingRefreshToken(
        input.refreshToken,
        {
            findById: () =>
                prisma.refreshToken.findFirst({
                    where: {
                        id: payload.jti,
                        userId,
                        expiresAt: { gt: now },
                    },
                }),
            findLegacy: () =>
                prisma.refreshToken.findMany({
                    where: { userId, expiresAt: { gt: now } },
                    orderBy: { createdAt: "desc" },
                }),
        },
        bcrypt.compare,
    );

    if (found) {
        await prisma.refreshToken.delete({ where: { id: found.id } });
    }
}
