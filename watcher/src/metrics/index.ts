import monitoring_v3 from '@google-cloud/monitoring'
import { config } from '../shared/config'
import { Anomaly, AnomalyType } from '../shared/index'

const metricsClient = new monitoring_v3.MetricServiceClient({
  projectId: config.GCP_PROJECT_ID,
})

export class MetricsPoller {
  /**
   * Query CPU utilization for a pod
   * Returns percentage (0-100)
   */
  async getCpuUtilization(
    service: string,
    namespace: string,
    pod: string,
  ): Promise<number | null> {
    try {
      const projectName = metricsClient.projectPath(config.GCP_PROJECT_ID)

      const filter = `
        resource.type="k8s_container"
        AND resource.labels.pod_name="${pod}"
        AND resource.labels.namespace_name="${namespace}"
        AND metric.type="kubernetes.io/container/cpu/core_usage_time"
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
      // Normalize to percentage (assuming 1 core available)
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
    service: string,
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
   * Returns errors per second
   */
//   async getErrorRate(
//     service: string,
//     namespace: string,
//   ): Promise<number | null> {
//     try {
//       const projectName = metricsClient.projectPath(config.GCP_PROJECT_ID)

//       // Count ERROR level logs in the last 60 seconds
//       const filter = `
//   resource.type="k8s_container"
//   AND resource.labels.container_name="${service}"
//   AND resource.labels.namespace_name="${namespace}"
// `.trim()

//       const request = {
//         name: projectName,
//         filter,
//         interval: {
//           endTime: { seconds: Math.floor(Date.now() / 1000) },
//           startTime: {
//             seconds: Math.floor((Date.now() - 60000) / 1000),
//           },
//         },
//       }

//       const [timeSeries] = await metricsClient.listTimeSeries(request)

//       if (!timeSeries || timeSeries.length === 0) {
//         return 0
//       }

//       const points = timeSeries[0].points || []
//       if (points.length === 0) return 0

//       // Estimate errors per second (60 second window)
//       const totalErrors = points.reduce((sum: number, p: any) => {
//         return sum + ((p.value as any)?.int64Value || 0)
//       }, 0)

//       return totalErrors / 60
//     } catch (error) {
//       console.error(`Error fetching error rate for ${service}:`, error)
//       return null
//     }
//   }

async getErrorRate(
  service: string,
  namespace: string,
): Promise<number | null> {
  // TODO:
  // Move error-rate calculation to Cloud Logging API
  // using logging.getEntries()

  return 0
}

  /**
   * Detect anomalies for a pod
   */
  async detectAnomalies(
    service: string,
    namespace: string,
    pod: string,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    // Check CPU
    const cpu = await this.getCpuUtilization(service, namespace, pod)
    if (cpu !== null && cpu > 80) {
      anomalies.push({
        service,
        namespace,
        pod,
        type: 'HIGH_CPU' as AnomalyType,
        value: cpu,
        threshold: 80,
        timestamp: new Date(),
      })
    }

    // Check Memory
    const memory = await this.getMemoryUtilization(service, namespace, pod)
    if (memory !== null && memory > 85) {
      anomalies.push({
        service,
        namespace,
        pod,
        type: 'HIGH_MEMORY' as AnomalyType,
        value: memory,
        threshold: 85,
        timestamp: new Date(),
      })
    }

    // Check Error Rate
    const errorRate = await this.getErrorRate(service, namespace)
    if (errorRate !== null && errorRate > 5) {
      anomalies.push({
        service,
        namespace,
        pod,
        type: 'HIGH_ERROR_RATE' as AnomalyType,
        value: errorRate,
        threshold: 5,
        timestamp: new Date(),
      })
    }

    return anomalies
  }
}

export const metricsPoller = new MetricsPoller()
