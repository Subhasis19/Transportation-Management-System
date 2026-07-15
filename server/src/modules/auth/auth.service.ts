import bcrypt from "bcrypt";
import { AppError } from "../../common/errors/app-error";
import { Role } from "../../generated/prisma/client";
import {
    issueRefreshToken,
    rotateRefreshToken,
    signAccessToken,
} from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import type { LoginInput, RegisterInput, RefreshTokenInput } from "./auth.schema";

export async function registerUser(input: RegisterInput) {
    const { password, ...profile } = input;
    const user = await prisma.user.create({
        data: {
            ...profile,
            email: profile.email.toLowerCase(),
            passwordHash: await bcrypt.hash(password, 12),
            role: Role.CUSTOMER,
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

    return {
        user: { id: user.id, name: user.name, role: user.role },
        accessToken: signAccessToken({
            id: user.id,
            role: user.role,
            email: user.email,
        }),
        refreshToken: await issueRefreshToken(user.id),
    };
}

export async function refreshAuthentication(input: RefreshTokenInput) {
    return rotateRefreshToken(input.refreshToken);
}

export async function logoutUser(userId: string, input: RefreshTokenInput) {
    const tokens = await prisma.refreshToken.findMany({
        where: { userId },
    });

    const found = await Promise.all(
        tokens.map(async (token) => ({
            token,
            matches: await bcrypt.compare(input.refreshToken, token.tokenHash),
        })),
    ).then((items) => items.find((item) => item.matches));

    if (found) {
        await prisma.refreshToken.delete({ where: { id: found.token.id } });
    }
}
