import { OutboxRepository } from '../../../application/ports/outbox-repository.interface';
import { OutboxEvent } from '../../../application/ports/outbox-event';

export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly events: OutboxEvent[] = [];
  private readonly processed = new Set<string>();

  async append(events: OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async findUnprocessed(limit?: number): Promise<OutboxEvent[]> {
    const unprocessed = this.events
      .filter((event) => !this.processed.has(event.eventId))
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    return limit === undefined ? unprocessed : unprocessed.slice(0, limit);
  }

  async markProcessed(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      this.processed.add(eventId);
    }
  }
}
