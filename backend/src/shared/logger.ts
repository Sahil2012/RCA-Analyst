type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return

  const entry = { timestamp: new Date().toISOString(), level, message, meta }
  const line  = JSON.stringify(entry)

  if (level === 'error') return console.error(line)
  if (level === 'warn')  return console.warn(line)
  console.log(line)
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
}
