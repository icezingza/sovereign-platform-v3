import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { MemoryRecord } from '../../../domain/memory/memory-record';
import { ListMemoriesOptions, MemoryRepository } from '../../../domain/memory/memory-repository.interface';
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

  async findAll(options: ListMemoriesOptions = {}): Promise<MemoryRecord[]> {
    const { status } = options;
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const rows = this.db
      .select()
      .from(memoryRecordsTable)
      .where(status ? eq(memoryRecordsTable.status, status) : undefined)
      .orderBy(desc(memoryRecordsTable.createdAt))
      .limit(limit)
      .offset(offset)
      .all();
    return rows.map((row) => MemoryRecord.reconstitute(MemoryMapper.toSnapshot(row)));
  }
}
