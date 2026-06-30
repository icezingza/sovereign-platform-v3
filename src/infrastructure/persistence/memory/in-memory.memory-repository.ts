import { MemoryRecord } from '../../../domain/memory/memory-record';
import { ListMemoriesOptions, MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { MemorySnapshot } from '../../../domain/memory/memory-snapshot';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly store = new Map<string, MemorySnapshot>();

  async save(memory: MemoryRecord): Promise<void> {
    this.store.set(memory.id.value, memory.toSnapshot());
  }

  async findById(id: MemoryId): Promise<MemoryRecord | null> {
    const snapshot = this.store.get(id.value);
    if (!snapshot) return null;
    return MemoryRecord.reconstitute(snapshot);
  }

  async delete(id: MemoryId): Promise<void> {
    this.store.delete(id.value);
  }

  async findAll(options: ListMemoriesOptions = {}): Promise<MemoryRecord[]> {
    const { status, search } = options;
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const needle = search?.toLowerCase();
    const snapshots = [...this.store.values()]
      .filter((snapshot) => !status || snapshot.status === status)
      .filter((snapshot) => !needle || snapshot.content.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return snapshots.slice(offset, offset + limit).map((snapshot) => MemoryRecord.reconstitute(snapshot));
  }
}
