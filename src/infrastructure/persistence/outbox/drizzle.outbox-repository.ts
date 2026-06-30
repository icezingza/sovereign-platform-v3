import { asc, inArray, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { OutboxEvent } from '../../../application/ports/outbox-event';
import { OutboxRepository } from '../../../application/ports/outbox-repository.interface';
import { OutboxMapper } from './mappers/outbox.mapper';
import { outboxEventsTable } from './schema/outbox-events.schema';

type DrizzleDB = ReturnType<typeof drizzle>;

export class DrizzleOutboxRepository implements OutboxRepository {
  constructor(private readonly db: DrizzleDB) {}

  async append(events: OutboxEvent[]): Promise<void> {
    if (events.length === 0) return;
    this.db
      .insert(outboxEventsTable)
      .values(events.map((event) => OutboxMapper.toRow(event)))
      .run();
  }

  async findUnprocessed(limit?: number): Promise<OutboxEvent[]> {
    let query = this.db
      .select()
      .from(outboxEventsTable)
      .where(isNull(outboxEventsTable.processedAt))
      .orderBy(asc(outboxEventsTable.occurredAt));

    const rows = limit === undefined ? query.all() : query.limit(limit).all();
    return rows.map((row) => OutboxMapper.toOutboxEvent(row));
  }

  async markProcessed(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    this.db
      .update(outboxEventsTable)
      .set({ processedAt: new Date().toISOString() })
      .where(inArray(outboxEventsTable.eventId, eventIds))
      .run();
  }
}
