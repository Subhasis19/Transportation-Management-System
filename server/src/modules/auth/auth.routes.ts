import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { authenticate } from "../../lib/auth";
import {
    login,
    logout,
    refresh,
    register,
} from "./auth.controller";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", authenticate, asyncHandler(logout));

export const authRouter = router;
