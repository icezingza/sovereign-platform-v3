import {
  UnitOfWork,
  UnitOfWorkContext,
} from '../../application/ports/unit-of-work.interface';
import { KnowledgeRepository } from '../../domain/knowledge/knowledge-repository.interface';
import { MemoryRepository } from '../../domain/memory/memory-repository.interface';
import { OutboxRepository } from '../../application/ports/outbox-repository.interface';

export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly repo: MemoryRepository,
    private readonly outbox: OutboxRepository,
    private readonly knowledgeRepo: KnowledgeRepository,
  ) {}

  async execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T> {
    return work({ repo: this.repo, knowledgeRepo: this.knowledgeRepo, outbox: this.outbox });
  }
}
