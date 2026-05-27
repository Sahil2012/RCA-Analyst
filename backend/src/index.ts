import "dotenv/config";
import { Server } from "node:http";
import { prisma, config, logger, startHealthServer } from "./shared";
import { startIncidentConsumer } from "./incidents";
import { startMcpServer } from "./mcp/mcpServer";
import { startApiServer } from "./api";

let healthServer: Server | undefined;
let mcpServer:    Server | undefined;
let apiServer:    Server | undefined;

function main() {
  healthServer = startHealthServer();
  mcpServer    = startMcpServer(prisma, config.MCP_PORT);
  apiServer    = startApiServer(prisma, config.API_PORT);
  logger.info("Starting RCA Analyst backend");
  startIncidentConsumer();
}

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  await Promise.all([
    new Promise<void>((resolve) => healthServer?.close(() => resolve()) ?? resolve()),
    new Promise<void>((resolve) => mcpServer?.close(() => resolve())    ?? resolve()),
    new Promise<void>((resolve) => apiServer?.close(() => resolve())    ?? resolve()),
  ]);
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
