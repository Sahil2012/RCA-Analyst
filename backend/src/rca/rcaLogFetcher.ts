import { Logging } from '@google-cloud/logging'
import { logger } from '../shared/logger'
import { Result, err, ok } from '../shared/types'
import { IRcaLogFetcher, LogFetchParams } from './rcaInterfaces'
import { RawLog, RawLogSchema } from './rcaTypes'

export class GcpLogFetcher implements IRcaLogFetcher {
  constructor(
    private readonly logging: Logging,
  ) {}

  async fetch(params: LogFetchParams): Promise<Result<RawLog[]>> {
    try {
      const [entries] = await this.logging.getEntries({
        filter:   this.buildFilter(params),
        orderBy:  'timestamp asc',
        pageSize: 1000,
      })

      const logs: RawLog[] = []
      for (const entry of entries) {
        const parsed = RawLogSchema.safeParse({
          timestamp: this.extractTimestamp(entry.metadata.timestamp),
          severity:  entry.metadata.severity ?? 'DEFAULT',
          message:   this.extractMessage(entry.data),
        })
        if (parsed.success) logs.push(parsed.data)
      }

      return ok(logs)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      logger.warn('GCP log fetch failed', { service: params.serviceName, error: error.message })
      return err(error)
    }
  }

  private buildFilter(params: LogFetchParams): string {
    const parts = [
      'resource.type="k8s_container"',
      'severity >= INFO',
      `resource.labels.namespace_name="${params.namespace}"`,
      `resource.labels.container_name="${params.serviceName}"`,
      `timestamp >= "${params.windowStart.toISOString()}"`,
      `timestamp <= "${params.windowEnd.toISOString()}"`,
    ]
    if (params.podName) {
      parts.push(`resource.labels.pod_name="${params.podName}"`)
    }
    return parts.join(' ')
  }

  private extractTimestamp(ts: unknown): string {
    if (!ts) return new Date().toISOString()
    if (ts instanceof Date) return ts.toISOString()
    if (typeof ts === 'string') return ts
    if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
      return new Date(Number((ts as { seconds: number }).seconds) * 1000).toISOString()
    }
    return new Date().toISOString()
  }

  private extractMessage(data: unknown): string {
    if (typeof data === 'string') return data
    if (Buffer.isBuffer(data)) return data.toString('utf8')
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      if (typeof obj['message'] === 'string') return obj['message']
      if (typeof obj['textPayload'] === 'string') return obj['textPayload']
      return JSON.stringify(data, null, 0)
    }
    return ''
  }
}
