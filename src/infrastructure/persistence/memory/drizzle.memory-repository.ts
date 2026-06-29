import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { MemoryRecord } from '../../../domain/memory/memory-record';
import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { MemoryMapper } from './mappers/memory.mapper';
import { memoryRecordsTable } from './schema/memory-records.schema';

type DrizzleDB = ReturnType<typeof drizzle>;

export class DrizzleMemoryRepository implements MemoryRepository {
  constructor(private readonly db: DrizzleDB) {}

  async save(memory: MemoryRecord): Promise<void> {
    const row = MemoryMapper.toRow(memory.toSnapshot());
    this.db
      .insert(memoryRecordsTable)
      .values(row)
      .onConflictDoUpdate({
        target: memoryRecordsTable.id,
        set: {
          content: row.content,
          importance: row.importance,
          status: row.status,
          refs: row.refs,
          version: row.version,
          updatedAt: row.updatedAt,
        },
      })
      .run();
  }

  async findById(id: MemoryId): Promise<MemoryRecord | null> {
    const row = this.db
      .select()
      .from(memoryRecordsTable)
      .where(eq(memoryRecordsTable.id, id.value))
      .get();
    if (!row) return null;
    return MemoryRecord.reconstitute(MemoryMapper.toSnapshot(row));
  }

  async delete(id: MemoryId): Promise<void> {
    this.db
      .delete(memoryRecordsTable)
      .where(eq(memoryRecordsTable.id, id.value))
      .run();
  }
}
