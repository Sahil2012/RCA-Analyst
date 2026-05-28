import dotenv from 'dotenv'
dotenv.config()
console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS)
import { PubSub } from '@google-cloud/pubsub'
import { config } from '../shared/config'
import { randomUUID } from 'crypto'

import {
  IncidentEvent,
  Anomaly,
  IncidentRules,
  determineSeverity,
  mapAnomalyToIncidentSource,
} from '../shared/index'

const pubSubClient = new PubSub({
  projectId: config.GCP_PROJECT_ID,
})

// Track recent incidents to avoid duplicates
interface IncidentRecord {
  key: string
  timestamp: number
  occurrences: number
}

const incidentHistory = new Map<string, IncidentRecord>();

// Clean up old incidents every 5 minutes
setInterval(() => {
  const now = Date.now()
  const thirtyMinutesAgo = now - 30 * 60 * 1000

  for (const [key, record] of incidentHistory.entries()) {
    if (record.timestamp < thirtyMinutesAgo) {
      incidentHistory.delete(key)
    }
  }
}, 5 * 60 * 1000)

export class IncidentEngine {
  private topic = pubSubClient.topic(config.PUBSUB_TOPIC)

  /**
   * Generate incident key for deduplication
   */
  private generateIncidentKey(
    service: string,
    namespace: string,
    pod: string,
    type: string,
  ): string {
    return `${namespace}/${pod}/${type}`
  }

  /**
   * Check if incident should be raised based on rules
   */
  private shouldRaiseIncident(
    anomaly: Anomaly,
    minOccurrences: number = 1,
  ): boolean {
    const key = this.generateIncidentKey(
      anomaly.service,
      anomaly.namespace,
      anomaly.pod,
      anomaly.type,
    )

    const existing = incidentHistory.get(key)

    if (!existing) {
      return true // First occurrence
    }

    // Check if enough time has passed to raise new incident
    const hourAgo = Date.now() - 60 * 60 * 1000
    if (existing.timestamp < hourAgo) {
      return true // More than an hour since last incident
    }

    // Check if occurrences meet threshold
    return existing.occurrences >= minOccurrences
  }

  /**
   * Convert anomaly to RCA incident event
   */
  private anomalyToIncident(anomaly: Anomaly): IncidentEvent {
    const key = this.generateIncidentKey(
      anomaly.service,
      anomaly.namespace,
      anomaly.pod,
      anomaly.type,
    )

    const existing = incidentHistory.get(key)
    const occurrences = (existing?.occurrences || 0) + 1

    // Update history
    incidentHistory.set(key, {
      key,
      timestamp: Date.now(),
      occurrences,
    })

    const severity = determineSeverity(anomaly.type, anomaly.value, anomaly.threshold)
    const source = mapAnomalyToIncidentSource(anomaly.type)
    const correlationId = randomUUID()

    return {
      serviceName: anomaly.service,
      namespace: anomaly.namespace,
      podName: anomaly.pod,
      type: anomaly.type, // Keep original AnomalyType
      severity,
      occurrences,
      source,
      correlationId,
      occurredAt: anomaly.timestamp.toISOString(),
    }
  }

  /**
   * Raise an incident and publish to PubSub
   */
  async raiseIncident(anomaly: Anomaly): Promise<string | null> {
    try {
      if (!this.shouldRaiseIncident(anomaly)) {
        console.log(
          `Skipping duplicate incident: ${anomaly.service}/${anomaly.pod}/${anomaly.type}`,
        )
        return null
      }

      const incident = this.anomalyToIncident(anomaly)

      const messageData = JSON.stringify(incident)

      const messageId = await this.topic.publish(Buffer.from(messageData))

      console.log(`Incident published: ${incident.serviceName}/${incident.podName} - ${incident.type}`)

      return messageId
    } catch (error) {
      console.error('Error raising incident:', error)
      return null
    }
  }

  /**
   * Process multiple anomalies and raise incidents
   */
  async processAnomalies(anomalies: Anomaly[]): Promise<string[]> {
    const publishedIds: string[] = []

    for (const anomaly of anomalies) {
      const id = await this.raiseIncident(anomaly)
      if (id) {
        publishedIds.push(id)
      }
    }

    return publishedIds
  }

  /**
   * Get incident statistics
   */
  getIncidentStats(): {
    totalActive: number
    byType: Record<string, number>
    byService: Record<string, number>
  } {
    const stats = {
      totalActive: incidentHistory.size,
      byType: {} as Record<string, number>,
      byService: {} as Record<string, number>,
    }

    for (const record of incidentHistory.values()) {
      const [, , type] = record.key.split('/')
      stats.byType[type] = (stats.byType[type] || 0) + 1
    }

    return stats
  }
}

export const incidentEngine = new IncidentEngine()
