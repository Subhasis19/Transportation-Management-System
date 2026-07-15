import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../common/errors/app-error";

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

    if (error instanceof Error) {
        res
            .status(
                error.message.includes("no longer") ||
                    error.message.includes("Only ")
                    ? 409
                    : 400,
            )
            .json({ message: error.message });

        return;
    }

    res.status(500).json({
        message: "Unexpected server error",
    });
};