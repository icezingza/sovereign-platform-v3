import { DomainEvent } from '../../domain/memory/events/domain-event';
import { EventBus } from '../../application/ports/event-bus.interface';

export class InMemoryEventBus implements EventBus {
  private readonly _events: DomainEvent[] = [];

  async publish(events: DomainEvent[]): Promise<void> {
    this._events.push(...events);
  }

  get events(): readonly DomainEvent[] {
    return this._events;
  }
}
