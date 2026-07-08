import { EventBus } from '../../application/ports/event-bus.interface';
import { OutboxEvent } from '../../application/ports/outbox-event';

export class InMemoryEventBus implements EventBus {
  private readonly _events: OutboxEvent[] = [];

  async publish(events: OutboxEvent[]): Promise<void> {
    this._events.push(...events);
  }

  get events(): readonly OutboxEvent[] {
    return this._events;
  }
}
