import { MetricServiceClient } from '@google-cloud/monitoring'
import { logger } from '../shared/logger'
import { Result, err, ok } from '../shared/types'
import { IRcaMetricsFetcher, MetricFetchParams } from './rcaInterfaces'
import { MetricSummary } from './rcaTypes'

const CPU_METRIC    = 'kubernetes.io/container/cpu/request_utilization'
const MEMORY_METRIC = 'kubernetes.io/container/memory/used_bytes'

export class GcpMetricsFetcher implements IRcaMetricsFetcher {
  constructor(
    private readonly client:    MetricServiceClient,
    private readonly projectId: string,
  ) {}

  async fetch(params: MetricFetchParams): Promise<Result<MetricSummary>> {
    try {
      const [cpuStats, memStats] = await Promise.all([
        this.fetchStats(params, CPU_METRIC),
        this.fetchStats(params, MEMORY_METRIC),
      ])

      return ok({
        cpuMax:     cpuStats?.max,
        cpuMean:    cpuStats?.mean,
        memoryMax:  memStats?.max,
        memoryMean: memStats?.mean,
      })
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      logger.warn('GCP metrics fetch failed', { service: params.serviceName, error: error.message })
      return err(error)
    }
  }

  private async fetchStats(
    params:     MetricFetchParams,
    metricType: string,
  ): Promise<{ max: number; mean: number } | null> {
    const [timeSeries] = await this.client.listTimeSeries({
      name:   `projects/${this.projectId}`,
      filter: [
        `metric.type="${metricType}"`,
        `resource.labels.namespace_name="${params.namespace}"`,
        `resource.labels.container_name="${params.serviceName}"`,
      ].join(' AND '),
      interval: {
        startTime: { seconds: Math.floor(params.windowStart.getTime() / 1000) },
        endTime:   { seconds: Math.floor(params.windowEnd.getTime() / 1000) },
      },
      view: 'FULL',
    })

    const values: number[] = []
    for (const series of timeSeries) {
      for (const point of series.points ?? []) {
        const v = point.value?.doubleValue ?? point.value?.int64Value
        if (v != null) values.push(Number(v))
      }
    }

    if (values.length === 0) return null

    const max  = Math.max(...values)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return { max, mean }
  }
}
