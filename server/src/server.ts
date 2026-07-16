import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const server = app.listen(env.PORT, () => {
  console.log(
    `TruckLine API running on http://localhost:${env.PORT}`,
  );
});

let shuttingDown = false;

async function shutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
    process.exit(exitCode);
  } catch {
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("unhandledRejection", () => {
  console.error("Unhandled promise rejection");
  void shutdown(1);
});
process.on("uncaughtException", () => {
  console.error("Uncaught exception");
  void shutdown(1);
});
