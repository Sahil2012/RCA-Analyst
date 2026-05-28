import { PubSub, Subscription } from '@google-cloud/pubsub'
import { logger } from '../shared/logger'
import { IMessageQueue, QueueMessageHandler } from '../shared/messageQueue'

interface PubSubConfig {
  GCP_PROJECT_ID:   string
  subscriptionName: string
  maxMessages?:     number
}

export class PubSubMessageQueue implements IMessageQueue {
  private readonly pubsub:       PubSub
  private readonly subscription: Subscription
  private subscribed = false

  constructor(cfg: PubSubConfig) {
    this.pubsub = new PubSub({ projectId: cfg.GCP_PROJECT_ID })

    this.subscription = this.pubsub.subscription(cfg.subscriptionName, {
      flowControl: { maxMessages: cfg.maxMessages ?? 10 },
    })
  }

  subscribe(handler: QueueMessageHandler): void {
    if (this.subscribed) return
    this.subscribed = true

    this.subscription.on('message', async (message) => {
      try {
        let payload: unknown

        try {
          payload = JSON.parse(message.data.toString())
        } catch {
          // Malformed JSON will never improve on redelivery
          logger.error('PubSub message is not valid JSON — discarding', { messageId: message.id })
          message.ack()
          return
        }

        const outcome = await handler(payload)
        outcome === 'ack' ? message.ack() : message.nack()
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e))
        logger.error('Unexpected error in message handler — nacking', { error: error.message })
        message.nack()
      }
    })

    this.subscription.on('error', (error) => {
      logger.error('PubSub subscription error', { error: error.message })
    })

    logger.info('PubSub queue subscribed', { subscription: this.subscription.name })
  }

  async close(): Promise<void> {
    await this.subscription.close()
    await this.pubsub.close()
    logger.info('PubSub queue closed', { subscription: this.subscription.name })
  }
}
