import dotenv from 'dotenv'
dotenv.config()
console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS)
import { PubSub } from '@google-cloud/pubsub'
import { config } from '../shared/config'

import {
  IncidentEvent,
  Anomaly,
  IncidentRules,
  determineSeverity,
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

// Track failed publishes to prevent silent message loss
interface FailedMessage {
  messageData: string
  anomaly: Anomaly
  attempts: number
  lastError: Error
  timestamp: number
}

const incidentHistory = new Map<string, IncidentRecord>();
const deadLetterQueue = new Map<string, FailedMessage>();

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

// Log dead letter queue status every minute
setInterval(() => {
  if (deadLetterQueue.size > 0) {
    console.warn(`⚠️ Dead Letter Queue has ${deadLetterQueue.size} failed messages`)
    for (const [id, msg] of deadLetterQueue.entries()) {
      console.warn(
        `  - ${id}: ${msg.attempts} attempts, last error: ${msg.lastError.message}`,
      )
    }
  }
}, 60 * 1000)

export class IncidentEngine {
  private topic = pubSubClient.topic(config.PUBSUB_TOPIC)
  private concurrencyLimit = 10 // Process up to 10 incidents in parallel
  private activePublishes = 0
  private maxRetries = 3
  private retryDelayMs = 1000 // Start with 1 second, exponential backoff

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
   * Acquire a slot for publishing (concurrency control)
   */
  private async acquirePublishSlot(): Promise<void> {
    while (this.activePublishes >= this.concurrencyLimit) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    this.activePublishes++
  }

  /**
   * Release a publishing slot
   */
  private releasePublishSlot(): void {
    this.activePublishes--
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 1,
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error
      }

      const backoffTime = this.retryDelayMs * Math.pow(2, attempt - 1)
      console.warn(
        `Publish attempt ${attempt} failed, retrying in ${backoffTime}ms: ${error instanceof Error ? error.message : String(error)}`,
      )

      await new Promise((resolve) => setTimeout(resolve, backoffTime))
      return this.retryWithBackoff(fn, attempt + 1)
    }
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
   * Convert anomaly to incident event
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

    return {
      service: anomaly.service,
      namespace: anomaly.namespace,
      pod: anomaly.pod,
      type: anomaly.type,
      severity,
      occurrences,
      timestamp: anomaly.timestamp,
      value: anomaly.value,
      threshold: anomaly.threshold,
    }
  }

  /**
   * Raise an incident and publish to PubSub with retry logic
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

      const messageData = JSON.stringify({
        ...incident,
        timestamp: incident.timestamp.toISOString(),
      })

      // Acquire concurrency slot
      await this.acquirePublishSlot()

      try {
        // Publish with retry logic
        const messageId = await this.retryWithBackoff(async () => {
          return await this.topic.publish(Buffer.from(messageData))
        })

        console.log(
          `✓ Incident published: ${incident.service}/${incident.pod} - ${incident.type}`,
        )

        return messageId
      } catch (error) {
        // Add to dead letter queue to prevent silent loss
        const dlqKey = `${incident.service}/${incident.pod}/${incident.type}/${Date.now()}`
        deadLetterQueue.set(dlqKey, {
          messageData,
          anomaly,
          attempts: this.maxRetries,
          lastError: error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
        })

        console.error(
          `✗ FAILED to publish incident after ${this.maxRetries} attempts: ${incident.service}/${incident.pod} - ${incident.type}`,
        )
        console.error(`  Added to DLQ: ${dlqKey}`)
        console.error(
          `  Error: ${error instanceof Error ? error.message : String(error)}`,
        )

        return null
      } finally {
        this.releasePublishSlot()
      }
    } catch (error) {
      console.error('Unexpected error in raiseIncident:', error)
      return null
    }
  }

  /**
   * Process multiple anomalies with concurrency control
   */
  async processAnomalies(anomalies: Anomaly[]): Promise<string[]> {
    const publishedIds: string[] = []

    // Create all publish promises with concurrency control
    const promises = anomalies.map((anomaly) => this.raiseIncident(anomaly))

    const results = await Promise.all(promises)

    for (const id of results) {
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

  /**
   * Get dead letter queue status
   */
  getDeadLetterQueueStats(): {
    count: number
    messages: Array<{
      id: string
      service: string
      pod: string
      attempts: number
      error: string
      timestamp: number
    }>
  } {
    const messages = Array.from(deadLetterQueue.entries()).map(([id, msg]) => ({
      id,
      service: msg.anomaly.service,
      pod: msg.anomaly.pod,
      attempts: msg.attempts,
      error: msg.lastError.message,
      timestamp: msg.timestamp,
    }))

    return {
      count: deadLetterQueue.size,
      messages,
    }
  }

  /**
   * Retry failed messages from dead letter queue
   */
  async retryDeadLetterQueue(): Promise<{ retried: number; succeeded: number }> {
    let retried = 0
    let succeeded = 0

    const messagesToRetry = Array.from(deadLetterQueue.entries())

    for (const [dlqKey, msg] of messagesToRetry) {
      retried++
      const id = await this.raiseIncident(msg.anomaly)

      if (id) {
        succeeded++
        deadLetterQueue.delete(dlqKey)
      }
    }

    console.log(
      `DLQ retry: ${retried} messages, ${succeeded} succeeded, ${retried - succeeded} failed`,
    )

    return { retried, succeeded }
  }
}

export const incidentEngine = new IncidentEngine()
