import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const knowledgeEntriesTable = sqliteTable('knowledge_entries', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  status: text('status', { enum: ['ACTIVE', 'ARCHIVED'] }).notNull(),
  version: integer('version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type KnowledgeRow = typeof knowledgeEntriesTable.$inferSelect;
export type NewKnowledgeRow = typeof knowledgeEntriesTable.$inferInsert;
