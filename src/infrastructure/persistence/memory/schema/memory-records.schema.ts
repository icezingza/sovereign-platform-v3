import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const memoryRecordsTable = sqliteTable('memory_records', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  importance: integer('importance').notNull(),
  status: text('status', { enum: ['ACTIVE', 'ARCHIVED', 'FORGOTTEN', 'DELETED'] }).notNull(),
  refs: text('refs').notNull(),
  version: integer('version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type MemoryRow = typeof memoryRecordsTable.$inferSelect;
export type NewMemoryRow = typeof memoryRecordsTable.$inferInsert;
