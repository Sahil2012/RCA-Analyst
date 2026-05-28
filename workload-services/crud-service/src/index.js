require("dotenv").config();
const express = require("express");
const cors = require("cors");
const usersRouter = require("./routes/users");
const testRouter  = require("./routes/test");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;

logger.info("Starting CRUD Service", { port: PORT, nodeEnv: process.env.NODE_ENV || "development" });

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;
  
  res.json = function(data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    logger.logRequest(req.method, req.path, statusCode, duration);
    logger.debug(`Response body`, { body: data, duration });
    return originalJson.call(this, data);
  };
  
  logger.debug(`Incoming ${req.method} ${req.path}`, { 
    query: Object.keys(req.query).length ? req.query : undefined,
    body: req.body && Object.keys(req.body).length ? { ...req.body, email: req.body.email ? "***" : undefined } : undefined
  });
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRUD Service — Supabase Users",
    version: "1.0.0",
    endpoints: {
      "GET    /api/users":          "List all users (supports ?page, ?limit, ?search)",
      "GET    /api/users/:id":      "Get user by ID",
      "POST   /api/users":          "Create user  { name, email }",
      "PUT    /api/users/:id":      "Replace user { name, email }",
      "PATCH  /api/users/:id":      "Update user  { name? email? }",
      "DELETE /api/users/:id":      "Delete user",
    },
  });
});

app.use("/api/users", usersRouter);
app.use("/api/test",  testRouter);

// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}`, { 
    message: err.message, 
    stack: err.stack 
  });
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`🚀 CRUD Service running on http://localhost:${PORT}`);
  logger.info(`📖 Docs at http://localhost:${PORT}`);
  logger.info("✅ Server is ready to accept requests");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { message: error.message, stack: error.stack });
  process.exit(1);
});
