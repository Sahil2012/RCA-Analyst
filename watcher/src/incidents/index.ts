import 'dotenv/config'
import { PubSub } from '@google-cloud/pubsub'
import { randomUUID } from 'crypto'
import { config } from '../shared/config'
import { logger } from '../shared/logger'
import {
  Anomaly,
  IncidentEvent,
  IncidentRules,
  Severity,
  determineSeverity,
  mapAnomalyToIncidentSource,
  mapAnomalyToIncidentType,
} from '../shared/index'

const pubSubClient = new PubSub({ projectId: config.GCP_PROJECT_ID })

// Route to severity-specific topic so the backend's priority queues work correctly
function topicForSeverity(severity: Severity) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return pubSubClient.topic(config.PUBSUB_TOPIC_HIGH)
  if (severity === 'MEDIUM')                           return pubSubClient.topic(config.PUBSUB_TOPIC_MEDIUM)
  return pubSubClient.topic(config.PUBSUB_TOPIC_LOW)
}

interface IncidentRecord {
  key:         string
  timestamp:   number
  occurrences: number
}

const incidentHistory = new Map<string, IncidentRecord>()

// Evict stale records every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [key, record] of incidentHistory.entries()) {
    if (record.timestamp < cutoff) incidentHistory.delete(key)
  }
}, 5 * 60 * 1000).unref()

export class IncidentEngine {
  private incidentKey(service: string, namespace: string, pod: string, type: string): string {
    return `${namespace}/${pod}/${type}`
  }

  private shouldRaise(anomaly: Anomaly, minOccurrences = 1): boolean {
    const key      = this.incidentKey(anomaly.service, anomaly.namespace, anomaly.pod, anomaly.type)
    const existing = incidentHistory.get(key)

    if (!existing) return true

    const hourAgo = Date.now() - 60 * 60 * 1000
    if (existing.timestamp < hourAgo) return true

    return existing.occurrences >= minOccurrences
  }

  private buildEvent(anomaly: Anomaly): IncidentEvent {
    const key        = this.incidentKey(anomaly.service, anomaly.namespace, anomaly.pod, anomaly.type)
    const existing   = incidentHistory.get(key)
    const occurrences = (existing?.occurrences ?? 0) + 1

    incidentHistory.set(key, { key, timestamp: Date.now(), occurrences })

    const severity = determineSeverity(anomaly.type, anomaly.value, anomaly.threshold)
    const source   = mapAnomalyToIncidentSource(anomaly.type)
    const type     = mapAnomalyToIncidentType(anomaly.type)

    return {
      serviceName:   anomaly.service,
      namespace:     anomaly.namespace,
      podName:       anomaly.pod,
      type,
      severity,
      occurrences,
      source,
      correlationId: randomUUID(),
      occurredAt:    anomaly.timestamp.toISOString(),
    }
  }

  async raiseIncident(anomaly: Anomaly): Promise<string | null> {
    try {
      if (!this.shouldRaise(anomaly)) {
        logger.debug('Skipping duplicate incident', { service: anomaly.service, type: anomaly.type })
        return null
      }

      const incident  = this.buildEvent(anomaly)
      const topic     = topicForSeverity(incident.severity)
      const messageId = await topic.publishMessage({ data: Buffer.from(JSON.stringify(incident)) })

      logger.info('Incident published', {
        service:  incident.serviceName,
        type:     incident.type,
        severity: incident.severity,
        topic:    topic.name,
        messageId,
      })

      return messageId
    } catch (error) {
      logger.error('Failed to publish incident', { error: String(error) })
      return null
    }
  }

  async processAnomalies(anomalies: Anomaly[]): Promise<string[]> {
    const ids: string[] = []
    for (const anomaly of anomalies) {
      const id = await this.raiseIncident(anomaly)
      if (id) ids.push(id)
    }
    return ids
  }

  getIncidentStats() {
    const byType: Record<string, number>    = {}
    const byService: Record<string, number> = {}

    for (const record of incidentHistory.values()) {
      const [, , type] = record.key.split('/')
      byType[type] = (byType[type] ?? 0) + 1
    }

    return { totalActive: incidentHistory.size, byType, byService }
  }
}

export const incidentEngine = new IncidentEngine()
