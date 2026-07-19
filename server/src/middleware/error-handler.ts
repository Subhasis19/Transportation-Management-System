import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../common/errors/app-error.js";
import { Prisma } from "../generated/prisma/client.js";

export const errorHandler: ErrorRequestHandler = (
    error,
    _req,
    res,
    _next,
) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            message: error.message,
            code: error.code,
            details: error.details,
        });
        return;
    }

    if (error instanceof z.ZodError) {
        res.status(400).json({
            message: "Validation failed",
            issues: error.issues,
        });
        return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            res.status(409).json({ message: "A conflicting record already exists" });
            return;
        }
        if (error.code === "P2025") {
            res.status(404).json({ message: "Requested record was not found" });
            return;
        }
    }

    if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 413
    ) {
        res.status(413).json({ message: "Request body too large" });
        return;
    }

    console.error("Unexpected server error");
    res.status(500).json({
        message: "Unexpected server error",
    });
};
