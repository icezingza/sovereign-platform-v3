import { EventBus } from '../ports/event-bus.interface';
import { OutboxRepository } from '../ports/outbox-repository.interface';

export class OutboxProcessor {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly eventBus: EventBus,
  ) {}

  async processPending(limit = 50): Promise<number> {
    const pending = await this.outbox.findUnprocessed(limit);
    if (pending.length === 0) return 0;

    await this.eventBus.publish(pending);
    await this.outbox.markProcessed(pending.map((event) => event.eventId));

    return pending.length;
  }
}
