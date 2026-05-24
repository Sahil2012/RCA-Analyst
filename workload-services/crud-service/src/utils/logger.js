/**
 * Simple logging utility with timestamps and log levels
 */

const levels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const levelNames = {
  0: "DEBUG",
  1: "INFO",
  2: "WARN",
  3: "ERROR",
};

const colors = {
  DEBUG: "\x1b[36m", // cyan
  INFO: "\x1b[32m",  // green
  WARN: "\x1b[33m",  // yellow
  ERROR: "\x1b[31m", // red
  RESET: "\x1b[0m",
};

const currentLevel = levels[process.env.LOG_LEVEL || "INFO"];

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, message, data = null) {
  if (levels[level] < currentLevel) return;

  const color = colors[level];
  const timestamp = formatTimestamp();
  const levelName = levelNames[levels[level]];

  let output = `${color}[${timestamp}] [${levelName}]${colors.RESET} ${message}`;

  if (data) {
    output += ` ${JSON.stringify(data)}`;
  }

  console.log(output);
}

module.exports = {
  debug: (message, data) => log("DEBUG", message, data),
  info: (message, data) => log("INFO", message, data),
  warn: (message, data) => log("WARN", message, data),
  error: (message, data) => log("ERROR", message, data),
  
  /**
   * Logs an HTTP request with details
   */
  logRequest: (method, url, statusCode = null, duration = null) => {
    const durationStr = duration ? ` | ${duration}ms` : "";
    const statusStr = statusCode ? ` | ${statusCode}` : "";
    log("INFO", `${method} ${url}${statusStr}${durationStr}`);
  },
  
  /**
   * Logs a database operation
   */
  logDbOperation: (operation, table, details = {}) => {
    const msg = `[DB] ${operation} on '${table}'`;
    log("DEBUG", msg, details);
  },
};
