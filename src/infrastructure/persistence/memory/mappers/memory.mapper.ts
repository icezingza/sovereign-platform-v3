import { MemorySnapshot } from '../../../../domain/memory/memory-snapshot';
import { MemoryStatus } from '../../../../domain/memory/memory-status';
import { MemoryRow, NewMemoryRow } from '../schema/memory-records.schema';

export class MemoryMapper {
  static toRow(snapshot: MemorySnapshot): NewMemoryRow {
    return {
      id: snapshot.id,
      content: snapshot.content,
      importance: snapshot.importance,
      status: snapshot.status,
      refs: JSON.stringify(Array.from(snapshot.references)),
      version: snapshot.version,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  static toSnapshot(row: MemoryRow): MemorySnapshot {
    return {
      id: row.id,
      content: row.content,
      importance: row.importance,
      status: row.status as MemoryStatus,
      references: JSON.parse(row.refs) as string[],
      version: row.version,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
