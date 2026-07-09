/**
 * SQLite persistence — the production adapters: better-sqlite3 + Drizzle,
 * a real transactional UnitOfWork, and the outbox polling driver draining
 * events in the background.
 *
 * Run from the repository root:
 *   npx tsx examples/sqlite-persistence.ts
 *
 * Uses an in-memory SQLite database by default; point DB_PATH at a file to
 * persist across runs, e.g. DB_PATH=./data/example.sqlite
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import {
  CreateMemoryHandler,
  DispatchingEventBus,
  DrizzleMemoryRepository,
  DrizzleOutboxRepository,
  DrizzleUnitOfWork,
  ensureSchema,
  GetMemoryByIdHandler,
  OutboxPollingDriver,
  OutboxProcessor,
  SystemClock,
} from '../src';

async function main() {
  // ── Open the database and create tables ───────────────────────────────────
  const sqlite = new Database(process.env.DB_PATH ?? ':memory:');
  ensureSchema(sqlite);
  const db = drizzle(sqlite);

  // ── Wire the production adapters ──────────────────────────────────────────
  const clock = new SystemClock();
  const unitOfWork = new DrizzleUnitOfWork(db);
  const createMemory = new CreateMemoryHandler(unitOfWork, clock);
  const getMemoryById = new GetMemoryByIdHandler(new DrizzleMemoryRepository(db));

  const eventBus = new DispatchingEventBus();
  eventBus.register({
    eventType: 'MemoryCreated',
    async handle(event) {
      console.log(`[consumer] received ${event.eventType} (${event.eventId})`);
    },
  });
  const processor = new OutboxProcessor(new DrizzleOutboxRepository(db), eventBus);
  const driver = new OutboxPollingDriver(processor, 200, (error) =>
    console.error('[outbox] tick failed:', error),
  );

  // ── Use it ────────────────────────────────────────────────────────────────
  driver.start();

  try {
    const id = await createMemory.execute({
      content: 'Persisted through a real SQLite transaction',
      importance: 7,
    });
    console.log('Created memory', id.value);

    const snapshot = await getMemoryById.execute({ id: id.value });
    console.log('Read back:', snapshot?.content, '| version:', snapshot?.version);

    // Give the polling driver a moment to drain the outbox, then shut down.
    await new Promise((resolve) => setTimeout(resolve, 500));
  } finally {
    driver.stop();
    sqlite.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
