import { prisma, config } from '../shared'
import { buildRcaService } from '../rca'
import { IAnalysisTrigger } from './incidentInterfaces'
import { IncidentConsumer } from './incidentConsumer'
import { IncidentDedup } from './incidentDedup'
import { IncidentFalsePositive } from './incidentFalsePositive'
import { PrismaIncidentRepository } from './incidentRepository'
import { IncidentService } from './incidentService'
import { PubSubMessageQueue } from './pubsubMessageQueue'

export function startIncidentConsumer(): { stop: () => Promise<void>; rcaService: IAnalysisTrigger } {
  const repo       = new PrismaIncidentRepository(prisma)
  const dedup      = new IncidentDedup(repo)
  const falsePos   = new IncidentFalsePositive(repo)
  const rcaService = buildRcaService()
  const service    = new IncidentService(dedup, falsePos, repo, rcaService)

  // Higher maxMessages = more concurrency = higher throughput for that severity
  const subscriptions: Array<{ subscriptionName: string; maxMessages: number }> = [
    { subscriptionName: config.PUBSUB_SUBSCRIPTION_HIGH,   maxMessages: 20 },
    { subscriptionName: config.PUBSUB_SUBSCRIPTION_MEDIUM, maxMessages: 10 },
    { subscriptionName: config.PUBSUB_SUBSCRIPTION_LOW,    maxMessages: 5  },
  ]

  const queues: PubSubMessageQueue[] = []

  for (const { subscriptionName, maxMessages } of subscriptions) {
    const queue    = new PubSubMessageQueue({ GCP_PROJECT_ID: config.GCP_PROJECT_ID, subscriptionName, maxMessages })
    const consumer = new IncidentConsumer(queue, service)
    consumer.start()
    queues.push(queue)
  }

  const stop = () => Promise.all(queues.map(q => q.close())).then(() => {})
  return { stop, rcaService }
}

export type { IncidentEvent } from './incidentTypes'
export type { ProcessOutcome } from './incidentInterfaces'
