import { MemoryRecord } from './memory-record';
import { MemoryId } from './value-objects/memory-id';

export interface MemoryRepository {
  save(memory: MemoryRecord): Promise<void>;
  findById(id: MemoryId): Promise<MemoryRecord | null>;
  delete(id: MemoryId): Promise<void>;
}
