import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { handlerProviders } from './infrastructure/composition/handlers.providers';
import { OutboxLifecycleService } from './infrastructure/composition/outbox-lifecycle.service';
import { persistenceProviders } from './infrastructure/composition/persistence.providers';
import { DomainErrorFilter } from './infrastructure/http/domain-error.filter';
import { KnowledgeController } from './infrastructure/http/knowledge.controller';
import { MemoryController } from './infrastructure/http/memory.controller';

@Module({
  controllers: [MemoryController, KnowledgeController],
  providers: [
    ...persistenceProviders,
    ...handlerProviders,
    OutboxLifecycleService,
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
