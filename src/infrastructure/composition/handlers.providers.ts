import { Provider } from '@nestjs/common';

import { KnowledgeRepository } from '../../domain/knowledge/knowledge-repository.interface';
import { MemoryRepository } from '../../domain/memory/memory-repository.interface';
import { TimeProvider } from '../../domain/memory/time/time-provider.interface';
import { UnitOfWork } from '../../application/ports/unit-of-work.interface';
import { ArchiveKnowledgeHandler } from '../../application/knowledge/commands/archive-knowledge.handler';
import { CreateKnowledgeHandler } from '../../application/knowledge/commands/create-knowledge.handler';
import { RestoreKnowledgeHandler } from '../../application/knowledge/commands/restore-knowledge.handler';
import { GetKnowledgeByIdHandler } from '../../application/knowledge/queries/get-knowledge-by-id.handler';
import { ArchiveMemoryHandler } from '../../application/memory/commands/archive-memory.handler';
import { CreateMemoryHandler } from '../../application/memory/commands/create-memory.handler';
import { DeleteMemoryHandler } from '../../application/memory/commands/delete-memory.handler';
import { ForgetMemoryHandler } from '../../application/memory/commands/forget-memory.handler';
import { LinkKnowledgeHandler } from '../../application/memory/commands/link-knowledge.handler';
import { RestoreMemoryHandler } from '../../application/memory/commands/restore-memory.handler';
import { GetMemoryByIdHandler } from '../../application/memory/queries/get-memory-by-id.handler';
import { CLOCK, KNOWLEDGE_REPOSITORY, MEMORY_REPOSITORY, UNIT_OF_WORK } from './tokens';

export const handlerProviders: Provider[] = [
  {
    provide: CreateMemoryHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new CreateMemoryHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: ArchiveMemoryHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new ArchiveMemoryHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: RestoreMemoryHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new RestoreMemoryHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: ForgetMemoryHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new ForgetMemoryHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: DeleteMemoryHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new DeleteMemoryHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: LinkKnowledgeHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new LinkKnowledgeHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: GetMemoryByIdHandler,
    useFactory: (repo: MemoryRepository) => new GetMemoryByIdHandler(repo),
    inject: [MEMORY_REPOSITORY],
  },
  {
    provide: CreateKnowledgeHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new CreateKnowledgeHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: ArchiveKnowledgeHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new ArchiveKnowledgeHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: RestoreKnowledgeHandler,
    useFactory: (uow: UnitOfWork, clock: TimeProvider) => new RestoreKnowledgeHandler(uow, clock),
    inject: [UNIT_OF_WORK, CLOCK],
  },
  {
    provide: GetKnowledgeByIdHandler,
    useFactory: (repo: KnowledgeRepository) => new GetKnowledgeByIdHandler(repo),
    inject: [KNOWLEDGE_REPOSITORY],
  },
];
