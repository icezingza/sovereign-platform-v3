import { OutboxEvent } from './outbox-event';

export interface EventBus {
  publish(events: OutboxEvent[]): Promise<void>;
}
