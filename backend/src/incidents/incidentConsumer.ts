import { logger } from '../shared/logger'
import { IMessageQueue, QueueHandlerOutcome } from '../shared/messageQueue'
import { IIncidentService } from './incidentInterfaces'
import { IncidentEventSchema } from './incidentTypes'

export class IncidentConsumer {
  private started = false

  constructor(
    private readonly queue:   IMessageQueue,
    private readonly service: IIncidentService,
  ) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.queue.subscribe(this.handleMessage.bind(this))
    logger.info('Incident consumer started')
  }

  private async handleMessage(payload: unknown): Promise<QueueHandlerOutcome> {
    const parsed = IncidentEventSchema.safeParse(payload)

    if (!parsed.success) {
      // Schema violations won't improve on redelivery — discard
      logger.error('Incident event failed schema validation — discarding', {
        errors: parsed.error.flatten().fieldErrors,
      })
      return 'ack'
    }

    const result = await this.service.process(parsed.data)

    if (!result.ok) {
      logger.error('Incident processing failed — redelivering', { error: result.error.message })
      return 'nack'
    }

    return 'ack'
  }
}
