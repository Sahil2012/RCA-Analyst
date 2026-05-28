import 'dotenv/config'

import { metricsPoller } from './metrics'
import { podPoller } from './pods'
import { incidentEngine } from './incidents'
import { config, getServicesToMonitor, getNamespacesToMonitor } from './shared/config'
import { logger } from './shared/logger'
import { Anomaly } from './shared/index'

class WatcherService {
  private metricsInterval: NodeJS.Timeout | null = null
  private podInterval:     NodeJS.Timeout | null = null
  private isRunning = false

  async start() {
    if (this.isRunning) return

    this.isRunning = true
    logger.info('Starting Watcher Service', {
      services:   getServicesToMonitor(),
      namespaces: getNamespacesToMonitor(),
    })

    this.metricsInterval = setInterval(() => this.pollMetrics(), config.METRICS_POLL_INTERVAL)
    this.podInterval     = setInterval(() => this.pollPods(),    config.POD_POLL_INTERVAL)

    await Promise.all([this.pollMetrics(), this.pollPods()])
    logger.info('Watcher Service started')
  }

  async stop() {
    if (!this.isRunning) return
    this.isRunning = false

    if (this.metricsInterval) { clearInterval(this.metricsInterval); this.metricsInterval = null }
    if (this.podInterval)     { clearInterval(this.podInterval);     this.podInterval     = null }

    logger.info('Watcher Service stopped')
  }

  private async pollMetrics() {
    const services   = getServicesToMonitor()
    const namespaces = getNamespacesToMonitor()
    const anomalies: Anomaly[] = []

    logger.info('Polling metrics')

    for (const service of services) {
      for (const namespace of namespaces) {
        // Error rate is service-level (no pod needed) — always runs
        const errorRateAnomalies = await metricsPoller.detectErrorRateAnomalies(service, namespace)
        anomalies.push(...errorRateAnomalies)

        // CPU/memory are pod-level — only runs when K8s is reachable
        const pods = await podPoller.listPods(namespace, `app=${service}`)
        for (const pod of pods) {
          const podAnomalies = await metricsPoller.detectPodAnomalies(service, namespace, pod.name)
          anomalies.push(...podAnomalies)
        }
      }
    }

    if (anomalies.length > 0) {
      logger.info(`Detected ${anomalies.length} metric anomalies`)
      await incidentEngine.processAnomalies(anomalies)
    }
  }

  private async pollPods() {
    const services   = getServicesToMonitor()
    const namespaces = getNamespacesToMonitor()
    const anomalies: Anomaly[] = []

    logger.info('Polling pod status')

    for (const service of services) {
      for (const namespace of namespaces) {
        const pods = await podPoller.listPods(namespace, `app=${service}`)
        for (const pod of pods) {
          const podAnomalies = await podPoller.detectPodAnomalies(service, namespace, pod)
          anomalies.push(...podAnomalies)
        }
      }
    }

    if (anomalies.length > 0) {
      logger.info(`Detected ${anomalies.length} pod anomalies`)
      await incidentEngine.processAnomalies(anomalies)
    }
  }

  getStats() {
    return {
      isRunning:            this.isRunning,
      incidentStats:        incidentEngine.getIncidentStats(),
      servicesMonitored:    getServicesToMonitor(),
      namespacesMonitored:  getNamespacesToMonitor(),
    }
  }
}

export const watcherService = new WatcherService()

process.on('SIGTERM', async () => { await watcherService.stop(); process.exit(0) })
process.on('SIGINT',  async () => { await watcherService.stop(); process.exit(0) })

watcherService.start().catch((error) => {
  logger.error('Failed to start watcher service', error)
  process.exit(1)
})
