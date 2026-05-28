import { IRcaSanitizer } from './rcaInterfaces'
import { RawLog, SanitizedLogEntry, SanitizedLogs } from './rcaTypes'

const SEVERITY_RANK: Record<string, number> = {
  EMERGENCY: 7, ALERT: 6, CRITICAL: 5, ERROR: 4,
  WARNING: 3,   WARN: 3,
  NOTICE: 2,    INFO: 1,
  DEBUG: 0,     DEFAULT: 0,
}

const CHARS_PER_TOKEN = 4

interface TokenOptimizerOptions {
  tokenBudget:    number   // max tokens for the log block
  maxMessageChars: number  // individual message cap — kills stack traces
}

export class RcaSanitizer implements IRcaSanitizer {
  constructor(private readonly opts: TokenOptimizerOptions = {
    tokenBudget:     6_000,
    maxMessageChars: 300,
  }) {}

  sanitize(logs: RawLog[]): SanitizedLogs {
    // Step 1 — truncate long messages (stack traces, JSON blobs)
    const truncated = logs.map(log => ({
      ...log,
      message: log.message.length > this.opts.maxMessageChars
        ? log.message.slice(0, this.opts.maxMessageChars) + ' [truncated]'
        : log.message,
    }))

    // Step 2 — deduplicate identical messages, keep highest severity + occurrence count
    const groups = new Map<string, { count: number; severity: string; timestamp: string }>()

    for (const log of truncated) {
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

    const all: SanitizedLogEntry[] = Array.from(groups.entries())
      .map(([message, meta]) => ({ message, ...meta }))

    // Step 3 — split into high-severity (ERROR+) vs timeline entries
    const highSeverity = all
      .filter(e => (SEVERITY_RANK[e.severity.toUpperCase()] ?? 0) >= SEVERITY_RANK['ERROR'])
      .sort((a, b) => (SEVERITY_RANK[b.severity.toUpperCase()] ?? 0) - (SEVERITY_RANK[a.severity.toUpperCase()] ?? 0))

    const timeline = all
      .filter(e => (SEVERITY_RANK[e.severity.toUpperCase()] ?? 0) < SEVERITY_RANK['ERROR'])
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)) // chronological

    const charBudget = this.opts.tokenBudget * CHARS_PER_TOKEN

    // Step 4 — fill 70% budget with high-severity first, then use remaining 30% for timeline
    const highBudget     = charBudget * 0.7
    const timelineBudget = charBudget * 0.3

    const kept: SanitizedLogEntry[] = []
    let dropped = 0

    let highUsed = 0
    for (const entry of highSeverity) {
      const cost = entry.message.length + entry.severity.length + 30
      if (highUsed + cost > highBudget) { dropped += entry.count; continue }
      kept.push(entry)
      highUsed += cost
    }

    let timelineUsed = 0
    for (const entry of timeline) {
      const cost = entry.message.length + entry.severity.length + 30
      if (timelineUsed + cost > timelineBudget) { dropped += entry.count; continue }
      kept.push(entry)
      timelineUsed += cost
    }

    // Re-sort final set chronologically so the LLM sees the timeline in order
    kept.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const totalChars = highUsed + timelineUsed
    return {
      entries:       kept,
      totalDropped:  dropped,
      tokenEstimate: Math.ceil(totalChars / CHARS_PER_TOKEN),
    }
  }
}
