import { prisma, config } from '../shared'
import { buildRcaService } from '../rca'
import { IncidentConsumer } from './incidentConsumer'
import { IncidentDedup } from './incidentDedup'
import { IncidentFalsePositive } from './incidentFalsePositive'
import { PrismaIncidentRepository } from './incidentRepository'
import { IncidentService } from './incidentService'
import { PubSubMessageQueue } from './pubsubMessageQueue'

export function startIncidentConsumer(): void {
  const repo        = new PrismaIncidentRepository(prisma)
  const dedup       = new IncidentDedup(repo)
  const falsePos    = new IncidentFalsePositive(repo)
  const rcaService  = buildRcaService()
  const service     = new IncidentService(dedup, falsePos, repo, rcaService)
  const queue       = new PubSubMessageQueue(config)
  const consumer    = new IncidentConsumer(queue, service)

  consumer.start()
}

export type { IncidentEvent } from './incidentTypes'
export type { ProcessOutcome } from './incidentInterfaces'
