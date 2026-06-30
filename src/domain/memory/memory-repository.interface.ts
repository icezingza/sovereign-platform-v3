import { MemoryRecord } from './memory-record';
import { MemoryStatus } from './memory-status';
import { MemoryId } from './value-objects/memory-id';

export interface ListMemoriesOptions {
  status?: MemoryStatus;
  limit?: number;
  offset?: number;
}

export interface MemoryRepository {
  save(memory: MemoryRecord): Promise<void>;
  findById(id: MemoryId): Promise<MemoryRecord | null>;
  delete(id: MemoryId): Promise<void>;
  findAll(options?: ListMemoriesOptions): Promise<MemoryRecord[]>;
}
