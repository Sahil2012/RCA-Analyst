/**
 * Creates the three pull subscriptions in GCP Pub/Sub if they don't already exist.
 * Run once during infra setup.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./credentials/watcher-service-key.json \
 *   GCP_PROJECT_ID=incident-analysis-497217 \
 *   npx tsx scripts/createSubscriptions.ts
 */
import { PubSub } from '@google-cloud/pubsub'

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'incident-analysis-497217'

const SUBSCRIPTIONS: Array<{ topic: string; subscription: string }> = [
  { topic: 'incident-high',   subscription: 'incidents-high-sub'   },
  { topic: 'incident-medium', subscription: 'incidents-medium-sub' },
  { topic: 'incident-low',    subscription: 'incidents-low-sub'    },
]

const pubsub = new PubSub({ projectId: PROJECT_ID })

async function ensureSubscription(topicName: string, subscriptionName: string): Promise<void> {
  const topic        = pubsub.topic(topicName)
  const subscription = topic.subscription(subscriptionName)

  const [exists] = await subscription.exists()
  if (exists) {
    console.log(`[SKIP] ${subscriptionName} already exists`)
    return
  }

  await topic.createSubscription(subscriptionName, {
    ackDeadlineSeconds: 60,
    retryPolicy: {
      minimumBackoff: { seconds: 10 },
      maximumBackoff: { seconds: 600 },
    },
  })
  console.log(`[OK]   ${subscriptionName} created on topic ${topicName}`)
}

async function main(): Promise<void> {
  for (const { topic, subscription } of SUBSCRIPTIONS) {
    await ensureSubscription(topic, subscription)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
