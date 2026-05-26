import { IRcaSanitizer } from './rcaInterfaces'
import { RawLog, SanitizedLogEntry, SanitizedLogs } from './rcaTypes'

const SEVERITY_RANK: Record<string, number> = {
  EMERGENCY: 7, ALERT: 6, CRITICAL: 5, ERROR: 4,
  WARNING: 3,   WARN: 3,
  NOTICE: 2,    INFO: 1,
  DEBUG: 0,     DEFAULT: 0,
}

const TOKEN_BUDGET    = 8_000
const CHARS_PER_TOKEN = 4

export class RcaSanitizer implements IRcaSanitizer {
  sanitize(logs: RawLog[]): SanitizedLogs {
    const groups = new Map<string, { count: number; severity: string; timestamp: string }>()

    for (const log of logs) {
      const existing = groups.get(log.message)
      if (!existing) {
        groups.set(log.message, { count: 1, severity: log.severity, timestamp: log.timestamp })
      } else {
        existing.count++
        const incomingRank = SEVERITY_RANK[log.severity.toUpperCase()] ?? 0
        const existingRank = SEVERITY_RANK[existing.severity.toUpperCase()] ?? 0
        if (incomingRank > existingRank) existing.severity = log.severity
      }
    }

    const sorted: SanitizedLogEntry[] = Array.from(groups.entries())
      .map(([message, meta]) => ({ message, ...meta }))
      .sort((a, b) => {
        const diff = (SEVERITY_RANK[b.severity.toUpperCase()] ?? 0)
                   - (SEVERITY_RANK[a.severity.toUpperCase()] ?? 0)
        return diff !== 0 ? diff : a.timestamp.localeCompare(b.timestamp)
      })

    const kept: SanitizedLogEntry[] = []
    let charCount = 0
    let dropped   = 0

    for (const entry of sorted) {
      const entryChars = entry.message.length + entry.severity.length + 30
      if (charCount + entryChars > TOKEN_BUDGET * CHARS_PER_TOKEN) {
        dropped += entry.count
        continue
      }
      kept.push(entry)
      charCount += entryChars
    }

    return {
      entries:       kept,
      totalDropped:  dropped,
      tokenEstimate: Math.ceil(charCount / CHARS_PER_TOKEN),
    }
  }
}
