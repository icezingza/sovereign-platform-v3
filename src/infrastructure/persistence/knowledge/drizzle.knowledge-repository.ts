import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { Knowledge } from '../../../domain/knowledge/knowledge';
import { KnowledgeRepository } from '../../../domain/knowledge/knowledge-repository.interface';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { KnowledgeMapper } from './mappers/knowledge.mapper';
import { knowledgeEntriesTable } from './schema/knowledge-entries.schema';

type DrizzleDB = ReturnType<typeof drizzle>;

export class DrizzleKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly db: DrizzleDB) {}

  async save(knowledge: Knowledge): Promise<void> {
    const row = KnowledgeMapper.toRow(knowledge.toSnapshot());
    this.db
      .insert(knowledgeEntriesTable)
      .values(row)
      .onConflictDoUpdate({
        target: knowledgeEntriesTable.id,
        set: {
          content: row.content,
          status: row.status,
          version: row.version,
          updatedAt: row.updatedAt,
        },
      })
      .run();
  }

  async findById(id: KnowledgeId): Promise<Knowledge | null> {
    const row = this.db
      .select()
      .from(knowledgeEntriesTable)
      .where(eq(knowledgeEntriesTable.id, id.value))
      .get();
    if (!row) return null;
    return Knowledge.reconstitute(KnowledgeMapper.toSnapshot(row));
  }

  async delete(id: KnowledgeId): Promise<void> {
    this.db
      .delete(knowledgeEntriesTable)
      .where(eq(knowledgeEntriesTable.id, id.value))
      .run();
  }
}
