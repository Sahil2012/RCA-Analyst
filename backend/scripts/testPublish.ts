/**
 * Publishes one test incident message to each severity topic.
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=./credentials/watcher-service-key.json \
 *        GCP_PROJECT_ID=incident-analysis-497217 \
 *        npx tsx scripts/testPublish.ts
 */
import { PubSub } from '@google-cloud/pubsub'

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'incident-analysis-497217'

const TOPICS: Array<{ topic: string; severity: string }> = [
  { topic: 'incident-high',   severity: 'HIGH'   },
  { topic: 'incident-medium', severity: 'MEDIUM' },
  { topic: 'incident-low',    severity: 'LOW'    },
]

const pubsub = new PubSub({ projectId: PROJECT_ID })

async function publish(topicName: string, severity: string): Promise<void> {
  const payload = {
    serviceName:   `payments-api-${Math.random().toString(36).slice(2, 6)}`,
    namespace:     'production',
    podName:       `payments-api-${Math.random().toString(36).slice(2, 8)}`,
    severity,
    type:          'LATENCY_SPIKE',
    occurrences:   3,
    source:        'GCP_MONITORING',
    correlationId: `test-${Date.now()}`,
    occurredAt:    new Date().toISOString(),
  }

  const messageId = await pubsub.topic(topicName).publishMessage({
    data: Buffer.from(JSON.stringify(payload)),
  })

  console.log(`[${severity}] published to ${topicName} → messageId=${messageId}`)
}

async function main(): Promise<void> {
  const targetSeverity = (process.env.SEVERITY ?? 'HIGH').toUpperCase()
  const matchingTopic = TOPICS.find((t) => t.severity === targetSeverity)

  if (matchingTopic) {
    console.log(`Publishing single incident with severity: ${targetSeverity}`)
    await publish(matchingTopic.topic, matchingTopic.severity)
  } else {
    console.log(`Unknown severity "${targetSeverity}". Publishing to incident-high by default.`)
    await publish('incident-high', 'HIGH')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
