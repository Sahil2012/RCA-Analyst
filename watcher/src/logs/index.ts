import { Logging } from '@google-cloud/logging'
import { config } from '../shared/config'

const logging = new Logging({
  projectId: config.GCP_PROJECT_ID,
})

export interface LogEntry {
  timestamp: Date
  severity: string
  message: string
  resource: string
  labels: Record<string, string>
}

interface LogMetadata {
  timestamp?: string
  severity?: string
  resource?: {
    type?: string
    labels?: Record<string, string>
  }
}

// Configuration constants
const INCIDENT_WINDOW_MINUTES = 5
const MAX_PAGE_SIZE = 1000
const MAX_ERROR_PATTERNS = 10
const MAX_PATTERN_LENGTH = 100
const LOG_FILTER_RESOURCE_TYPE = 'k8s_pod'
const SUPPORTED_SEVERITIES = ['ERROR', 'WARNING']

export class LogFetcher {
  private readonly incidentWindowMs = INCIDENT_WINDOW_MINUTES * 60 * 1000
  private readonly pageSize = MAX_PAGE_SIZE

  /**
   * Build a safe log filter query for Cloud Logging API
   */
  private buildLogFilter(
    pod: string,
    namespace: string,
    startTime: Date,
    endTime: Date,
  ): string {
    const startTimeStr = startTime.toISOString()
    const endTimeStr = endTime.toISOString()
    const severityFilter = SUPPORTED_SEVERITIES.map((s) => `severity="${s}"`).join(' OR ')

    return [
      `resource.type="${LOG_FILTER_RESOURCE_TYPE}"`,
      `resource.labels.pod_name="${pod}"`,
      `resource.labels.namespace_name="${namespace}"`,
      `(${severityFilter})`,
      `timestamp>="${startTimeStr}"`,
      `timestamp<="${endTimeStr}"`,
    ].join('\n AND ')
  }

  /**
   * Parse a raw log entry from Cloud Logging API
   */
  private parseLogEntry(entry: any): LogEntry {
    const metadata: LogMetadata = entry.metadata || {}
    const timestamp = metadata.timestamp ? new Date(metadata.timestamp) : new Date()
    const podName = metadata.resource?.labels?.pod_name || 'unknown'
    const resourceType = metadata.resource?.type || 'unknown'

    return {
      timestamp,
      severity: metadata.severity || 'UNKNOWN',
      message: entry.data || JSON.stringify(entry),
      resource: `${resourceType}/${podName}`,
      labels: metadata.resource?.labels || {},
    }
  }

  /**
   * Extract and normalize a message pattern for grouping
   */
  private extractMessagePattern(message: string): string {
    return message.split('\n')[0].substring(0, MAX_PATTERN_LENGTH)
  }

  /**
   * Validate input parameters
   */
  private validateInputs(
    namespace: string,
    pod: string,
    startTime: Date,
    endTime: Date,
  ): void {
    if (!namespace?.trim()) throw new Error('namespace is required')
    if (!pod?.trim()) throw new Error('pod is required')
    if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
      throw new Error('startTime must be a valid Date')
    }
    if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
      throw new Error('endTime must be a valid Date')
    }
    if (startTime >= endTime) {
      throw new Error('startTime must be before endTime')
    }
  }

  /**
   * Fetch logs for a service/pod within a time window
   * Filters for ERROR and WARNING severity only
   */
  async fetchLogs(
    service: string,
    namespace: string,
    pod: string,
    startTime: Date,
    endTime: Date,
  ): Promise<LogEntry[]> {
    try {
      this.validateInputs(namespace, pod, startTime, endTime)

      const filter = this.buildLogFilter(pod, namespace, startTime, endTime)

      const [entries] = await (logging as any).getEntries({
        filter,
        pageSize: this.pageSize,
        autoPaginate: false,
      })

      if (!entries?.length) {
        return []
      }

      return entries
        .map((entry: any) => this.parseLogEntry(entry))
        .sort((a: LogEntry, b: LogEntry) => a.timestamp.getTime() - b.timestamp.getTime())
    } catch (error) {
      console.error(
        `Error fetching logs for ${pod} in ${namespace}:`,
        error instanceof Error ? error.message : error,
      )
      return []
    }
  }

  /**
   * Fetch logs for incident investigation (5 minutes before/after incident time)
   */
  async fetchIncidentLogs(
    service: string,
    namespace: string,
    pod: string,
    incidentTime: Date,
  ): Promise<LogEntry[]> {
    if (!(incidentTime instanceof Date) || isNaN(incidentTime.getTime())) {
      throw new Error('incidentTime must be a valid Date')
    }

    const startTime = new Date(incidentTime.getTime() - this.incidentWindowMs)
    const endTime = new Date(incidentTime.getTime() + this.incidentWindowMs)

    return this.fetchLogs(service, namespace, pod, startTime, endTime)
  }

  /**
   * Analyze logs for common error patterns
   */
  analyzeErrorPatterns(logs: LogEntry[]): { pattern: string; count: number }[] {
    const patterns = new Map<string, number>()

    for (const log of logs) {
      const pattern = this.extractMessagePattern(log.message)
      patterns.set(pattern, (patterns.get(pattern) ?? 0) + 1)
    }

    return Array.from(patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ERROR_PATTERNS)
  }

  /**
   * Get log summary statistics
   */
  getLogSummary(logs: LogEntry[]): {
    totalLogs: number
    errorCount: number
    warningCount: number
    firstLog: Date | null
    lastLog: Date | null
  } {
    if (logs.length === 0) {
      return {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        firstLog: null,
        lastLog: null,
      }
    }

    return {
      totalLogs: logs.length,
      errorCount: logs.filter((l) => l.severity === 'ERROR').length,
      warningCount: logs.filter((l) => l.severity === 'WARNING').length,
      firstLog: logs[0].timestamp,
      lastLog: logs[logs.length - 1].timestamp,
    }
  }
}

export const logFetcher = new LogFetcher()
