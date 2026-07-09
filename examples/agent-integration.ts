/**
 * Agent integration — the full application layer wired with the in-memory
 * adapters: command/query handlers, UnitOfWork, transactional outbox, and an
 * event consumer receiving events through the DispatchingEventBus.
 *
 * This is the same wiring the production composition root uses, minus SQLite
 * and NestJS — swap the InMemory* adapters for the Drizzle* ones to persist
 * to a real database (see examples/README.md).
 *
 * Run from the repository root:
 *   npx tsx examples/agent-integration.ts
 */
import {
  ArchiveMemoryHandler,
  CreateKnowledgeHandler,
  CreateMemoryHandler,
  DispatchingEventBus,
  EventConsumer,
  GetMemoryByIdHandler,
  InMemoryKnowledgeRepository,
  InMemoryMemoryRepository,
  InMemoryOutboxRepository,
  InMemoryUnitOfWork,
  LinkKnowledgeHandler,
  ListMemoriesHandler,
  MemoryStatus,
  OutboxEvent,
  OutboxProcessor,
  SystemClock,
} from '../src';

async function main() {
  // ── Wiring (what the composition root does in production) ────────────────
  const clock = new SystemClock();
  const memoryRepo = new InMemoryMemoryRepository();
  const knowledgeRepo = new InMemoryKnowledgeRepository();
  const outbox = new InMemoryOutboxRepository();
  const unitOfWork = new InMemoryUnitOfWork(memoryRepo, outbox, knowledgeRepo);

  const createMemory = new CreateMemoryHandler(unitOfWork, clock);
  const archiveMemory = new ArchiveMemoryHandler(unitOfWork, clock);
  const createKnowledge = new CreateKnowledgeHandler(unitOfWork, clock);
  const linkKnowledge = new LinkKnowledgeHandler(unitOfWork, clock);
  const getMemoryById = new GetMemoryByIdHandler(memoryRepo);
  const listMemories = new ListMemoriesHandler(memoryRepo);

  // A downstream consumer subscribed to one event type.
  const eventBus = new DispatchingEventBus();
  const auditLog: EventConsumer = {
    eventType: 'MemoryCreated',
    async handle(event: OutboxEvent) {
      console.log(`[audit] ${event.eventType} for aggregate ${event.aggregateId}`);
    },
  };
  eventBus.register(auditLog);
  const outboxProcessor = new OutboxProcessor(outbox, eventBus);

  // ── An agent using its memory ─────────────────────────────────────────────
  // 1. Remember something the user said.
  const memoryId = await createMemory.execute({
    content: 'User prefers dark blue theme with neon cyan accents',
    importance: 9,
  });
  console.log('Memory created:', memoryId.value);

  // 2. Ground it: create a knowledge entry and link it (the handler verifies
  //    the knowledge actually exists before linking).
  const knowledgeId = await createKnowledge.execute({
    content: 'Brand guideline: primary palette is dark blue / neon cyan',
  });
  await linkKnowledge.execute({ id: memoryId.value, knowledgeId: knowledgeId.value });
  console.log('Linked knowledge:', knowledgeId.value);

  // 3. Read it back (query side returns immutable snapshots, not aggregates).
  const snapshot = await getMemoryById.execute({ id: memoryId.value });
  console.log('Recalled:', snapshot?.content, '| references:', snapshot?.references);

  // 4. Search recent active memories.
  const results = await listMemories.execute({
    status: MemoryStatus.ACTIVE,
    search: 'theme',
    limit: 10,
  });
  console.log(`Search found ${results.length} active memorie(s) matching "theme"`);

  // 5. Archive an old memory.
  await archiveMemory.execute({ id: memoryId.value });
  console.log('Archived. Status now:', (await getMemoryById.execute({ id: memoryId.value }))?.status);

  // 6. Drain the transactional outbox — this is when consumers actually run.
  //    In production OutboxPollingDriver calls this on an interval.
  const processed = await outboxProcessor.processPending();
  console.log(`Outbox drained: ${processed} event(s) published`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
