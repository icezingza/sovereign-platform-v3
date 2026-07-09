// Public API of sovereign-platform-v3.
// The NestJS HTTP layer (main.ts, app.module.ts, infrastructure/http,
// infrastructure/composition) is an application, not part of the library
// surface, and is intentionally not exported here.

// ── Domain: Memory aggregate ────────────────────────────────────────────────
export { MemoryRecord } from './domain/memory/memory-record';
export { MemoryStatus } from './domain/memory/memory-status';
export { MemorySnapshot } from './domain/memory/memory-snapshot';
export {
  MemoryRepository,
  ListMemoriesOptions,
} from './domain/memory/memory-repository.interface';
export { MemoryId } from './domain/memory/value-objects/memory-id';
export { KnowledgeId } from './domain/memory/value-objects/knowledge-id';
export { Importance } from './domain/memory/value-objects/importance';
export {
  DomainError,
  InvalidStateTransitionError,
  InvalidOperationError,
} from './domain/memory/errors/domain-error';
export { DomainEvent, DomainEventProps } from './domain/memory/events/domain-event';
export { MemoryCreatedEvent } from './domain/memory/events/memory-created.event';
export { MemoryArchivedEvent } from './domain/memory/events/memory-archived.event';
export { MemoryRestoredEvent } from './domain/memory/events/memory-restored.event';
export { MemoryForgottenEvent } from './domain/memory/events/memory-forgotten.event';
export { MemoryDeletedEvent } from './domain/memory/events/memory-deleted.event';
export { KnowledgeLinkedEvent } from './domain/memory/events/knowledge-linked.event';

// ── Domain: Knowledge aggregate ─────────────────────────────────────────────
export { Knowledge } from './domain/knowledge/knowledge';
export { KnowledgeStatus } from './domain/knowledge/knowledge-status';
export { KnowledgeSnapshot } from './domain/knowledge/knowledge-snapshot';
export {
  KnowledgeRepository,
  ListKnowledgeOptions,
} from './domain/knowledge/knowledge-repository.interface';
export { KnowledgeCreatedEvent } from './domain/knowledge/events/knowledge-created.event';
export { KnowledgeArchivedEvent } from './domain/knowledge/events/knowledge-archived.event';
export { KnowledgeRestoredEvent } from './domain/knowledge/events/knowledge-restored.event';

// ── Domain: Time ────────────────────────────────────────────────────────────
export { TimeProvider } from './domain/memory/time/time-provider.interface';
export { SystemClock } from './domain/memory/time/system-clock';
export { FakeClock } from './domain/memory/time/fake-clock';

// ── Application: ports ──────────────────────────────────────────────────────
export { EventBus } from './application/ports/event-bus.interface';
export { EventConsumer } from './application/ports/event-consumer.interface';
export { OutboxEvent } from './application/ports/outbox-event';
export { OutboxRepository } from './application/ports/outbox-repository.interface';
export { UnitOfWork, UnitOfWorkContext } from './application/ports/unit-of-work.interface';

// ── Application: errors ─────────────────────────────────────────────────────
export {
  ApplicationError,
  MemoryNotFoundError,
} from './application/memory/errors/application-error';
export { KnowledgeNotFoundError } from './application/knowledge/errors/application-error';

// ── Application: memory commands & queries ──────────────────────────────────
export {
  CreateMemoryHandler,
  CreateMemoryCommand,
} from './application/memory/commands/create-memory.handler';
export {
  ArchiveMemoryHandler,
  ArchiveMemoryCommand,
} from './application/memory/commands/archive-memory.handler';
export {
  RestoreMemoryHandler,
  RestoreMemoryCommand,
} from './application/memory/commands/restore-memory.handler';
export {
  ForgetMemoryHandler,
  ForgetMemoryCommand,
} from './application/memory/commands/forget-memory.handler';
export {
  DeleteMemoryHandler,
  DeleteMemoryCommand,
} from './application/memory/commands/delete-memory.handler';
export {
  LinkKnowledgeHandler,
  LinkKnowledgeCommand,
} from './application/memory/commands/link-knowledge.handler';
export {
  GetMemoryByIdHandler,
  GetMemoryByIdQuery,
} from './application/memory/queries/get-memory-by-id.handler';
export {
  ListMemoriesHandler,
  ListMemoriesQuery,
} from './application/memory/queries/list-memories.handler';
export { EventSerializer } from './application/memory/mappers/event-serializer';

// ── Application: knowledge commands & queries ───────────────────────────────
export {
  CreateKnowledgeHandler,
  CreateKnowledgeCommand,
} from './application/knowledge/commands/create-knowledge.handler';
export {
  ArchiveKnowledgeHandler,
  ArchiveKnowledgeCommand,
} from './application/knowledge/commands/archive-knowledge.handler';
export {
  RestoreKnowledgeHandler,
  RestoreKnowledgeCommand,
} from './application/knowledge/commands/restore-knowledge.handler';
export {
  GetKnowledgeByIdHandler,
  GetKnowledgeByIdQuery,
} from './application/knowledge/queries/get-knowledge-by-id.handler';
export {
  ListKnowledgeHandler,
  ListKnowledgeQuery,
} from './application/knowledge/queries/list-knowledge.handler';

// ── Application: services ───────────────────────────────────────────────────
export { OutboxProcessor } from './application/services/outbox-processor';
export { OutboxPollingDriver } from './application/services/outbox-polling-driver';

// ── Infrastructure: adapters ────────────────────────────────────────────────
export { InMemoryMemoryRepository } from './infrastructure/persistence/memory/in-memory.memory-repository';
export { DrizzleMemoryRepository } from './infrastructure/persistence/memory/drizzle.memory-repository';
export { InMemoryKnowledgeRepository } from './infrastructure/persistence/knowledge/in-memory.knowledge-repository';
export { DrizzleKnowledgeRepository } from './infrastructure/persistence/knowledge/drizzle.knowledge-repository';
export { InMemoryOutboxRepository } from './infrastructure/persistence/outbox/in-memory.outbox-repository';
export { DrizzleOutboxRepository } from './infrastructure/persistence/outbox/drizzle.outbox-repository';
export { InMemoryUnitOfWork } from './infrastructure/persistence/in-memory.unit-of-work';
export { DrizzleUnitOfWork } from './infrastructure/persistence/drizzle.unit-of-work';
export { InMemoryEventBus } from './infrastructure/events/in-memory.event-bus';
export { DispatchingEventBus } from './infrastructure/events/dispatching.event-bus';
export { ensureSchema } from './infrastructure/persistence/schema';
