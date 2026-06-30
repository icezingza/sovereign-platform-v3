import { ListMemoriesOptions, MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { MemorySnapshot } from '../../../domain/memory/memory-snapshot';

export type ListMemoriesQuery = ListMemoriesOptions;

export class ListMemoriesHandler {
  constructor(private readonly repository: MemoryRepository) {}

  async execute(query: ListMemoriesQuery = {}): Promise<MemorySnapshot[]> {
    const memories = await this.repository.findAll(query);
    return memories.map((memory) => memory.toSnapshot());
  }
}
