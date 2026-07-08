import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { MemorySnapshot } from '../../../domain/memory/memory-snapshot';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';

export interface GetMemoryByIdQuery {
  id: string;
}

export class GetMemoryByIdHandler {
  constructor(private readonly repository: MemoryRepository) {}

  async execute(query: GetMemoryByIdQuery): Promise<MemorySnapshot | null> {
    const memory = await this.repository.findById(MemoryId.create(query.id));
    return memory ? memory.toSnapshot() : null;
  }
}
