import { KnowledgeRepository } from '../../domain/knowledge/knowledge-repository.interface';
import { MemoryRepository } from '../../domain/memory/memory-repository.interface';
import { OutboxRepository } from './outbox-repository.interface';

export interface UnitOfWorkContext {
  readonly repo: MemoryRepository;
  readonly knowledgeRepo: KnowledgeRepository;
  readonly outbox: OutboxRepository;
}

export interface UnitOfWork {
  execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}
