import { logger } from '../shared/logger'
import { IIncidentDedup, IIncidentRepository } from './incidentInterfaces'
import { IncidentEvent } from './incidentTypes'

// Single source of truth — passed to the repository query so both sides
// always use the same window. No duplicated constant.
export const DEDUP_WINDOW_MS = 5 * 60 * 1000

export class IncidentDedup implements IIncidentDedup {
  // L1 in-memory cache: `serviceName:type` → last seen timestamp (ms)
  private readonly cache = new Map<string, number>()

  constructor(private readonly repo: IIncidentRepository) {}

  async isDuplicate(event: IncidentEvent): Promise<boolean> {
    this.evictStale()

    const key  = `${event.serviceName}:${event.type}`
    const now  = Date.now()
    const meta = { service: event.serviceName, type: event.type }

    // L1 — memory
    const lastSeen = this.cache.get(key)
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      logger.info('Duplicate dropped (cache)', meta)
      return true
    }

    // L2 — database
    const existing = await this.repo.findOpenDuplicate(
      event.serviceName,
      event.type,
      DEDUP_WINDOW_MS,
    )
    if (existing) {
      this.cache.set(key, now)
      logger.info('Duplicate dropped (db)', { ...meta, existingId: existing.id })
      return true
    }

    return false
  }

  // Called by IncidentService after a confirmed DB write — never before.
  markSeen(event: IncidentEvent): void {
    const key = `${event.serviceName}:${event.type}`
    this.cache.set(key, Date.now())
  }

  // Purge entries older than the dedup window to prevent unbounded growth.
  private evictStale(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS
    for (const [key, ts] of this.cache) {
      if (ts < cutoff) this.cache.delete(key)
    }
  }
}
