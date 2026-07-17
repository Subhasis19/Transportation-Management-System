import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { apiRateLimiter } from "./middleware/rate-limit";
import { authRouter } from "./modules/auth/auth.routes";
import {
  locationRouter,
  adminLocationRouter,
} from "./modules/locations/location.routes";
import {
  quoteRouter,
  adminRouteRouter,
} from "./modules/routes/route.routes";
import { adminVehicleRouter } from "./modules/vehicles/vehicle.routes";
import { adminPricingRouter } from "./modules/pricing/pricing.routes";
import { adminDriverRouter } from "./modules/drivers/driver.routes";
import { adminUserRouter } from "./modules/users/user.routes";
import { adminDashboardRouter } from "./modules/dashboard/dashboard.routes";
import {
  bookingRouter,
  adminBookingRouter,
  driverBookingRouter,
} from "./modules/bookings/booking.routes";

const app = express();
app.disable("x-powered-by");
if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || origin === env.FRONTEND_URL);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(apiRateLimiter);
app.use("/auth", authRouter);
app.use("/locations", locationRouter);
app.use("/quotes", quoteRouter);
app.use("/admin/locations", adminLocationRouter);
app.use("/admin/routes", adminRouteRouter);
app.use("/admin/vehicles", adminVehicleRouter);
app.use("/admin/rate-cards", adminPricingRouter);
app.use("/admin/drivers", adminDriverRouter);
app.use("/admin/users", adminUserRouter);
app.use("/admin/dashboard", adminDashboardRouter);
app.use("/bookings", bookingRouter);
app.use("/admin/bookings", adminBookingRouter);
app.use("/driver/bookings", driverBookingRouter);

app.get("/health", (_req, res) =>
  res.json({ success: true, message: "TruckLine API is running" }),
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
