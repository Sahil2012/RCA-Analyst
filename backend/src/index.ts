import "dotenv/config";
import { Server } from "node:http";
import { prisma, config, logger, startHealthServer } from "./shared";
import { startIncidentConsumer } from "./incidents";
import { startMcpServer } from "./mcp/mcpServer";
import { startApiServer } from "./api";

let healthServer:    Server | undefined;
let mcpServer:       Server | undefined;
let apiServer:       Server | undefined;
let closeConsumers: (() => Promise<void>) | undefined;

function main() {
  logger.info("Starting RCA Analyst backend");
  healthServer    = startHealthServer();
  mcpServer       = startMcpServer(prisma, config.MCP_PORT);
  apiServer       = startApiServer(prisma, config.API_PORT);
  closeConsumers  = startIncidentConsumer();
}

function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down`);

  // Fire-and-forget best-effort cleanup. We do NOT await this —
  // pubsub.close() uses gRPC and can hang indefinitely, which would
  // prevent process.exit() from ever being called.
  void Promise.all([
    new Promise<void>((resolve) => healthServer?.close(() => resolve()) ?? resolve()),
    new Promise<void>((resolve) => mcpServer?.close(() => resolve())    ?? resolve()),
    new Promise<void>((resolve) => apiServer?.close(() => resolve())    ?? resolve()),
    closeConsumers?.() ?? Promise.resolve(),
  ])
    .then(() => prisma.$disconnect())
    .catch(() => { /* best-effort */ })

  // Guaranteed hard exit — always runs regardless of cleanup state.
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

main();
