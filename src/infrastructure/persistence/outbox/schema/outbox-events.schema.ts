import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const outboxEventsTable = sqliteTable('outbox_events', {
  eventId: text('event_id').primaryKey(),
  aggregateId: text('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(),
  schemaVersion: integer('schema_version').notNull(),
  occurredAt: text('occurred_at').notNull(),
  processedAt: text('processed_at'),
});

export type OutboxEventRow = typeof outboxEventsTable.$inferSelect;
export type NewOutboxEventRow = typeof outboxEventsTable.$inferInsert;
