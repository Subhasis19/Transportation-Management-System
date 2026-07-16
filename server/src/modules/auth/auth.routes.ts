import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { authenticate } from "../../lib/auth";
import {
    loginRateLimiter,
    refreshRateLimiter,
    registerRateLimiter,
} from "../../middleware/rate-limit";
import {
    login,
    logout,
    refresh,
    register,
} from "./auth.controller";

const router = Router();

router.post("/register", registerRateLimiter, asyncHandler(register));
router.post("/login", loginRateLimiter, asyncHandler(login));
router.post("/refresh", refreshRateLimiter, asyncHandler(refresh));
router.post("/logout", authenticate, asyncHandler(logout));

export const authRouter = router;
