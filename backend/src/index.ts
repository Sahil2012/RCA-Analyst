import "dotenv/config";
import { Server } from "node:http";
import { prisma, logger, startHealthServer } from "./shared";
import { startIncidentConsumer } from "./incidents";

let healthServer: Server | undefined;

function main() {
  healthServer = startHealthServer();
  logger.info("Starting RCA Analyst backend");
  startIncidentConsumer();
}

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  await new Promise<void>(
    (resolve) => healthServer?.close(() => resolve()) ?? resolve(),
  );
  await prisma.$disconnect();
  process.exit(0);
}

const handleShutdown = (signal: string) =>
  shutdown(signal).catch((e) => {
    logger.error("Error during shutdown", { error: String(e) });
    process.exit(1);
  });

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

main();
