import { MemoryRecord } from '../../../domain/memory/memory-record';
import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
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
}
