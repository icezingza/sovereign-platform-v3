import { MemoryRepository } from '../../domain/memory/memory-repository.interface';
import { OutboxRepository } from './outbox-repository.interface';

export interface UnitOfWorkContext {
  readonly repo: MemoryRepository;
  readonly outbox: OutboxRepository;
}

export interface UnitOfWork {
  execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}
