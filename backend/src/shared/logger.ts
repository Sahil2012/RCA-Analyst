type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
}

const LEVEL_STYLE: Record<LogLevel, { color: string; label: string }> = {
  info:  { color: C.cyan,   label: 'INFO ' },
  warn:  { color: C.yellow, label: 'WARN ' },
  error: { color: C.red,    label: 'ERROR' },
  debug: { color: C.gray,   label: 'DEBUG' },
}

const IS_JSON = process.env['LOG_FORMAT'] === 'json'

function formatMeta(meta: Record<string, unknown>): string {
  return Object.entries(meta)
    .map(([k, v]) => {
      const val     = String(v)
      const display = val.length > 100 ? val.slice(0, 100) + '…' : val
      return `${C.dim}${k}${C.reset}${C.gray}=${C.reset}${display}`
    })
    .join(`  ${C.gray}·${C.reset}  `)
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (level === 'debug' && process.env['NODE_ENV'] === 'production') return

  if (IS_JSON) {
    const entry = { timestamp: new Date().toISOString(), level, message, meta }
    const line  = JSON.stringify(entry)
    if (level === 'error') return console.error(line)
    if (level === 'warn')  return console.warn(line)
    return console.log(line)
  }

  const time  = new Date().toISOString().slice(11, 23)
  const { color, label } = LEVEL_STYLE[level]

  const timeStr  = `${C.gray}${time}${C.reset}`
  const levelStr = `${C.bold}${color}${label}${C.reset}`
  const msgStr   = `${C.white}${C.bold}${message}${C.reset}`
  const metaStr  = meta && Object.keys(meta).length > 0
    ? `\n             ${C.dim}${formatMeta(meta)}${C.reset}`
    : ''

  const line = `${timeStr}  ${levelStr}  ${msgStr}${metaStr}`

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
