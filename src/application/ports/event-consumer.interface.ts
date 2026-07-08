import { OutboxEvent } from './outbox-event';

export interface EventConsumer {
  readonly eventType: string;
  handle(event: OutboxEvent): Promise<void>;
}
