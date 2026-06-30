import { DomainEvent } from '../../../domain/memory/events/domain-event';
import { OutboxEvent } from '../../ports/outbox-event';

export class EventSerializer {
  static toOutboxEvent(event: DomainEvent): OutboxEvent {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: (event as unknown as { eventType: string }).eventType,
      occurredAt: event.occurredAt,
      schemaVersion: event.schemaVersion,
      payload: { ...event } as Record<string, unknown>,
    };
  }

  static toOutboxEvents(events: DomainEvent[]): OutboxEvent[] {
    return events.map((event) => EventSerializer.toOutboxEvent(event));
  }
}
