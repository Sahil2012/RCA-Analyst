/**
 * Logger utility for the watcher service
 * Provides structured logging with timestamps and levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO

  setLevel(level: LogLevel) {
    this.level = level
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (level < this.level) {
      return
    }

    const timestamp = new Date().toISOString()
    const levelName = LogLevel[level].padEnd(5)

    if (data !== undefined) {
      console.log(`[${timestamp}] ${levelName} ${message}`, data)
    } else {
      console.log(`[${timestamp}] ${levelName} ${message}`)
    }
  }

  debug(message: string, data?: unknown) {
    this.log(LogLevel.DEBUG, message, data)
  }

  info(message: string, data?: unknown) {
    this.log(LogLevel.INFO, message, data)
  }

  warn(message: string, data?: unknown) {
    this.log(LogLevel.WARN, message, data)
  }

  error(message: string, data?: unknown) {
    this.log(LogLevel.ERROR, message, data)
  }
}

export const logger = new Logger()
