import type { Express } from "express";

export function configureTrustProxy(
  app: Express,
  nodeEnv: string,
  trustProxy: boolean,
) {
  if (nodeEnv === "production" || trustProxy) {
    app.set("trust proxy", 1);
  }
}
