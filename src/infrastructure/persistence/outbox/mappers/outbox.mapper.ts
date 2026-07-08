import { OutboxEvent } from '../../../../application/ports/outbox-event';
import { NewOutboxEventRow, OutboxEventRow } from '../schema/outbox-events.schema';

export class OutboxMapper {
  static toRow(event: OutboxEvent): NewOutboxEventRow {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: JSON.stringify(event.payload),
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt.toISOString(),
      processedAt: null,
    };
  }

  static toOutboxEvent(row: OutboxEventRow): OutboxEvent {
    return {
      eventId: row.eventId,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      occurredAt: new Date(row.occurredAt),
      schemaVersion: row.schemaVersion,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
    };
  }
}
