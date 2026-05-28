import monitoring_v3 from '@google-cloud/monitoring'
import { config } from '../shared/config'
import { Anomaly } from '../shared/index'
import { logFetcher } from '../logs/index'

const metricsClient = new monitoring_v3.MetricServiceClient({
  projectId: config.GCP_PROJECT_ID,
})

export class MetricsPoller {
  /**
   * Query CPU utilization for a pod
   * Returns percentage (0-100)
   */
  async getCpuUtilization(
    _service: string,
    namespace: string,
    pod: string,
  ): Promise<number | null> {
    try {
      const projectName = metricsClient.projectPath(config.GCP_PROJECT_ID)

      const filter = `
        resource.type="k8s_container"
        AND resource.labels.pod_name="${pod}"
        AND resource.labels.namespace_name="${namespace}"
        AND metric.type="kubernetes.io/container/cpu/limit_utilization"
      `.trim()

      const request = {
        name: projectName,
        filter,
        interval: {
          endTime: { seconds: Math.floor(Date.now() / 1000) },
          startTime: {
            seconds: Math.floor((Date.now() - 60000) / 1000), // Last 1 minute
          },
        },
      }

      const [timeSeries] = await metricsClient.listTimeSeries(request)

      if (!timeSeries || timeSeries.length === 0) {
        return null
      }

      // Calculate average CPU usage
      const points = timeSeries[0].points || []
      if (points.length === 0) return null

      const values = points
        .map((p: any) => (p.value as any)?.doubleValue || 0)
        .filter((v: number) => v > 0)

      if (values.length === 0) return null

      const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length
      // limit_utilization is already a 0-1 ratio — convert to 0-100
      return Math.min(avgValue * 100, 100)
    } catch (error) {
      console.error(`Error fetching CPU for ${pod}:`, error)
      return null
    }
  }

  /**
   * Query memory utilization for a pod
   * Returns percentage (0-100)
   */
  async getMemoryUtilization(
    _service: string,
    namespace: string,
    pod: string,
  ): Promise<number | null> {
    try {
      const projectName = metricsClient.projectPath(config.GCP_PROJECT_ID)

      const filter = `
  metric.type="kubernetes.io/container/memory/used_bytes"
  AND resource.type="k8s_container"
  AND resource.labels.namespace_name="${namespace}"
  AND resource.labels.pod_name="${pod}"
`.trim()


      const request = {
        name: projectName,
        filter,
        interval: {
          endTime: { seconds: Math.floor(Date.now() / 1000) },
          startTime: {
            seconds: Math.floor((Date.now() - 60000) / 1000), // Last 1 minute
          },
        },
      }

      const [timeSeries] = await metricsClient.listTimeSeries(request)

      if (!timeSeries || timeSeries.length === 0) {
        return null
      }

      const points = timeSeries[0].points || []
      if (points.length === 0) return null

      const values = points.map((p: any) => (p.value as any)?.int64Value || 0)
      if (values.length === 0) return null

      const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length
      // Assuming 512MB limit, convert to percentage
      const limitBytes = 512 * 1024 * 1024
      return Math.min((avgValue / limitBytes) * 100, 100)
    } catch (error) {
      console.error(`Error fetching memory for ${pod}:`, error)
      return null
    }
  }

  /**
   * Query error rate from logs
   * Counts ERROR severity logs in the last 60 seconds
   * Returns errors per second
   */
  async getErrorRate(
    service: string,
    namespace: string,
  ): Promise<number | null> {
    try {
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - 60000) // Last 60 seconds

      // Fetch ERROR logs using Cloud Logging API
      // Using '*' for pod since we want service-level error rate
      const logs = await logFetcher.fetchLogs(
        service,
        namespace,
        '*',
        startTime,
        endTime,
      )

      // Count only ERROR severity logs
      const errorCount = logs.filter(
        (log) => log.severity === 'ERROR' || log.severity === 'ERROR',
      ).length

      // Calculate errors per second (60 second window)
      const errorsPerSecond = errorCount / 60

      return errorsPerSecond
    } catch (error) {
      console.error(
        `Error fetching error rate for ${service}/${namespace}:`,
        error,
      )
      return null
    }
  }

  // Pod-level: CPU + memory (requires K8s pod name)
  async detectPodAnomalies(service: string, namespace: string, pod: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    const cpu = await this.getCpuUtilization(service, namespace, pod)
    if (cpu !== null && cpu > 80) {
      anomalies.push({ service, namespace, pod, type: 'HIGH_CPU' , value: cpu, threshold: 80, timestamp: new Date() })
    }

    const memory = await this.getMemoryUtilization(service, namespace, pod)
    if (memory !== null && memory > 85) {
      anomalies.push({ service, namespace, pod, type: 'HIGH_MEMORY' , value: memory, threshold: 85, timestamp: new Date() })
    }

    return anomalies
  }

  // Service-level: error rate from Cloud Logging (no pod name needed — always runs)
  async detectErrorRateAnomalies(service: string, namespace: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    const errorRate = await this.getErrorRate(service, namespace)
    if (errorRate !== null && errorRate > 5) {
      anomalies.push({ service, namespace, pod: service, type: 'HIGH_ERROR_RATE' , value: errorRate, threshold: 5, timestamp: new Date() })
    }

    return anomalies
  }
}

export const metricsPoller = new MetricsPoller()
