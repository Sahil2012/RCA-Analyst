import { Logging } from '@google-cloud/logging'
import { config } from '../shared/config'
import { logger } from '../shared/logger'

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

export class LogFetcher {
  /**
   * Fetch logs for a service/pod within a time window
   * Filters for ERROR and WARN only
   */
  async fetchLogs(
    service: string,
    namespace: string,
    pod: string,
    startTime: Date,
    endTime: Date,
  ): Promise<LogEntry[]> {
    try {
      const startTimeStr = startTime.toISOString()
      const endTimeStr   = endTime.toISOString()

      // k8s_container is the correct resource type for GKE workload logs.
      // When pod === '*' (service-level error rate check) omit pod filter and
      // match by container_name instead — Cloud Logging has no wildcard syntax.
      const podFilter = pod !== '*'
        ? `resource.labels.pod_name="${pod}"`
        : `resource.labels.container_name="${service}"`

      // Match both structured severity labels AND plain-text logs (e.g. "[ERROR]", "exception")
      // since workload services may log to stdout without structured JSON.
      const severityFilter = '(severity="ERROR" OR severity="WARNING" OR severity="CRITICAL" OR textPayload=~"(?i)(error|exception|failed|crash|timeout)")'

      const filter = [
        'resource.type="k8s_container"',
        `resource.labels.namespace_name="${namespace}"`,
        podFilter,
        severityFilter,
        `timestamp>="${startTimeStr}"`,
        `timestamp<="${endTimeStr}"`,
      ].join(' AND ')

      const [entries] = await (logging as any).getEntries({
        filter,
        pageSize: 1000,
        autoPaginate: false,
      })

      if (!entries || entries.length === 0) return []

      return entries
        .map((entry: any) => {
          const metadata  = entry.metadata || {}
          const timestamp = metadata.timestamp ? new Date(metadata.timestamp) : new Date()
          return {
            timestamp,
            severity: metadata.severity || 'UNKNOWN',
            message:  entry.data || JSON.stringify(entry),
            resource: `${metadata.resource?.type}/${metadata.resource?.labels?.pod_name}`,
            labels:   metadata.resource?.labels || {},
          }
        })
        .sort((a: LogEntry, b: LogEntry) => a.timestamp.getTime() - b.timestamp.getTime())
    } catch (error) {
      logger.error(`Error fetching logs for ${service}/${pod}`, (error as Error).message)
      return []
    }
  }
  /**
   * Fetch logs for incident investigation
   * Returns structured log data for analysis
   */
  async fetchIncidentLogs(
    service: string,
    namespace: string,
    pod: string,
    incidentTime: Date,
  ): Promise<LogEntry[]> {
    // Fetch logs from 5 minutes before to 5 minutes after the incident
    const startTime = new Date(incidentTime.getTime() - 5 * 60 * 1000)
    const endTime = new Date(incidentTime.getTime() + 5 * 60 * 1000)

    return this.fetchLogs(service, namespace, pod, startTime, endTime)
  }

  /**
   * Analyze logs for common error patterns
   */
  analyzeErrorPatterns(logs: LogEntry[]): { pattern: string; count: number }[] {
    const patterns = new Map<string, number>()

    for (const log of logs) {
      // Extract first line of message as pattern
      const firstLine = log.message.split('\n')[0].substring(0, 100)
      patterns.set(firstLine, (patterns.get(firstLine) || 0) + 1)
    }

    return Array.from(patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 patterns
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
    return {
      totalLogs: logs.length,
      errorCount: logs.filter((l) => l.severity === 'ERROR').length,
      warningCount: logs.filter((l) => l.severity === 'WARNING').length,
      firstLog: logs.length > 0 ? logs[0].timestamp : null,
      lastLog: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    }
  }
}

export const logFetcher = new LogFetcher()
