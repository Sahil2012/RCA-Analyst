function formatTimestamp() {
  return new Date().toISOString();
}

function formatMeta(meta = {}) {
  return Object.entries(meta)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
}

function log(level, message, meta = {}) {
  const parts = [`[${formatTimestamp()}]`, `[${level.toUpperCase()}]`, message];
  const metaString = formatMeta(meta);
  console.log(parts.join(" ") + (metaString ? ` ${metaString}` : ""));
}

function info(message, meta) {
  log("info", message, meta);
}

function warn(message, meta) {
  log("warn", message, meta);
}

function error(message, meta) {
  log("error", message, meta);
}

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    info("HTTP request completed", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      ip: req.ip,
    });
  });

  next();
}

module.exports = {
  info,
  warn,
  error,
  requestLogger,
};
