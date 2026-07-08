import { OutboxEvent } from './outbox-event';

export interface OutboxRepository {
  append(events: OutboxEvent[]): Promise<void>;
  findUnprocessed(limit?: number): Promise<OutboxEvent[]>;
  markProcessed(eventIds: string[]): Promise<void>;
}
