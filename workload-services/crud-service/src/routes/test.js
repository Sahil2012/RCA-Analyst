const express = require("express");
const logger  = require("../utils/logger");

const router = express.Router();

// GET /api/test/crash — kills the pod, K8s restarts it → triggers POD_CRASH incident
router.get("/crash", (req, res) => {
  logger.error("Chaos endpoint triggered — intentional crash", { endpoint: "/api/test/crash" });
  res.json({ message: "Crashing pod in 500ms..." });
  setTimeout(() => process.exit(1), 500);
});

// GET /api/test/errors — floods logs with ERROR entries → triggers HIGH_ERROR_RATE
router.get("/errors", (req, res) => {
  const count = parseInt(req.query.count ?? "50", 10);
  for (let i = 0; i < count; i++) {
    logger.error(`Simulated error ${i + 1}/${count}`, {
      code:    "SIMULATED_FAILURE",
      service: "crud-service",
      attempt: i + 1,
    });
  }
  res.json({ message: `Logged ${count} errors. Watcher will detect HIGH_ERROR_RATE within 30s.` });
});

// GET /api/test/cpu — spikes CPU for 30s → triggers HIGH_CPU
router.get("/cpu", (req, res) => {
  const durationMs = parseInt(req.query.duration ?? "30000", 10);
  res.json({ message: `CPU spike running for ${durationMs / 1000}s. Watcher detects within 30s.` });
  const end = Date.now() + durationMs;
  setImmediate(function spin() {
    if (Date.now() < end) setImmediate(spin);
  });
});

module.exports = router;
