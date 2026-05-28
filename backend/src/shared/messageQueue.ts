export type QueueHandlerOutcome  = 'ack' | 'nack'
export type QueueMessageHandler  = (payload: unknown) => Promise<QueueHandlerOutcome>

export interface IMessageQueue {
  subscribe(handler: QueueMessageHandler): void
  close(): Promise<void>
}
