import 'dotenv/config'

import { metricsPoller } from './metrics'
import { podPoller } from './pods'
import { incidentEngine } from './incidents'
import { logFetcher } from './logs'
import { config, getServicesToMonitor, getNamespacesToMonitor } from './shared/config'
import { Anomaly } from './shared/index'

/**
 * Main Watcher Service
 *
 * Responsibilities:
 * 1. Poll GCP Cloud Monitoring every 30s for CPU, memory, error rate anomalies
 * 2. Poll K8s pod status every 30s to detect pod crashes and restarts
 * 3. Apply incident rules to anomalies
 * 4. Publish incident events to PubSub
 * 5. Fetch logs for incident investigation
 */
class WatcherService {
  private metricsInterval: NodeJS.Timeout | null = null
  private podInterval: NodeJS.Timeout | null = null
  private isRunning = false

  async start() {
    if (this.isRunning) {
      console.log('Watcher service already running')
      return
    }

    this.isRunning = true
    console.log('Starting Watcher Service...')

    // Start metrics polling
    this.metricsInterval = setInterval(
      () => this.pollMetrics(),
      config.METRICS_POLL_INTERVAL,
    )

    // Start pod polling
    this.podInterval = setInterval(() => this.pollPods(), config.POD_POLL_INTERVAL)

    // Run initial polls
    await this.pollMetrics()
    await this.pollPods()

    console.log('Watcher Service started successfully')
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Watcher service not running')
      return
    }

    this.isRunning = false

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = null
    }

    if (this.podInterval) {
      clearInterval(this.podInterval)
      this.podInterval = null
    }

    console.log('Watcher Service stopped')
  }

  /**
   * Poll metrics from GCP Cloud Monitoring
   */
  private async pollMetrics() {
    try {
      const services = getServicesToMonitor()
      const namespaces = getNamespacesToMonitor()

      console.log(`[${new Date().toISOString()}] Polling metrics...`)

      const allAnomalies: Anomaly[] = []

      for (const service of services) {
        for (const namespace of namespaces) {
          // Get pods for this service in namespace
          const pods = await podPoller.listPods(namespace, `app=${service}`)

          for (const pod of pods) {
            // Detect anomalies for each pod
            const podAnomalies = await metricsPoller.detectAnomalies(
              service,
              namespace,
              pod.name,
            )

            allAnomalies.push(...podAnomalies)
          }
        }
      }

      // Process anomalies
      if (allAnomalies.length > 0) {
        console.log(`Detected ${allAnomalies.length} metric anomalies`)
        await incidentEngine.processAnomalies(allAnomalies)
      }
    } catch (error) {
      console.error('Error during metrics polling:', error)
    }
  }

  /**
   * Poll pod status from Kubernetes
   */
  private async pollPods() {
    try {
      const services = getServicesToMonitor()
      const namespaces = getNamespacesToMonitor()

      console.log(`[${new Date().toISOString()}] Polling pod status...`)

      const allAnomalies: Anomaly[] = []

      for (const service of services) {
        for (const namespace of namespaces) {
          // List pods with service label
          const pods = await podPoller.listPods(namespace, `app=${service}`)

          for (const pod of pods) {
            // Detect pod-related anomalies (crashes, restarts)
            const podAnomalies = await podPoller.detectPodAnomalies(
              service,
              namespace,
              pod,
            )

            allAnomalies.push(...podAnomalies)
          }
        }
      }

      // Process anomalies
      if (allAnomalies.length > 0) {
        console.log(`Detected ${allAnomalies.length} pod anomalies`)
        await incidentEngine.processAnomalies(allAnomalies)
      }
    } catch (error) {
      console.error('Error during pod polling:', error)
    }
  }

  /**
   * Fetch logs for an incident (called by backend when analyzing an incident)
   */
  async getIncidentLogs(
    service: string,
    namespace: string,
    pod: string,
    incidentTime: Date,
  ) {
    try {
      const logs = await logFetcher.fetchIncidentLogs(
        service,
        namespace,
        pod,
        incidentTime,
      )

      const summary = logFetcher.getLogSummary(logs)
      const patterns = logFetcher.analyzeErrorPatterns(logs)

      return {
        logs,
        summary,
        patterns,
      }
    } catch (error) {
      console.error('Error fetching incident logs:', error)
      return {
        logs: [],
        summary: {
          totalLogs: 0,
          errorCount: 0,
          warningCount: 0,
          firstLog: null,
          lastLog: null,
        },
        patterns: [],
      }
    }
  }

  /**
   * Get current watcher statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      incidentStats: incidentEngine.getIncidentStats(),
      servicesMonitored: getServicesToMonitor(),
      namespacesMonitored: getNamespacesToMonitor(),
    }
  }
}

export const watcherService = new WatcherService()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server')
  await watcherService.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server')
  await watcherService.stop()
  process.exit(0)
})

// Start the service
watcherService.start().catch((error) => {
  console.error('Failed to start watcher service:', error)
  process.exit(1)
})
