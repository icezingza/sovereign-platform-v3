import * as fs from 'fs';
import * as path from 'path';

import { Logger, Provider } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { SystemClock } from '../../domain/memory/time/system-clock';
import { OutboxProcessor } from '../../application/services/outbox-processor';
import { OutboxPollingDriver } from '../../application/services/outbox-polling-driver';
import { DispatchingEventBus } from '../events/dispatching.event-bus';
import { DrizzleUnitOfWork } from '../persistence/drizzle.unit-of-work';
import { DrizzleKnowledgeRepository } from '../persistence/knowledge/drizzle.knowledge-repository';
import { DrizzleMemoryRepository } from '../persistence/memory/drizzle.memory-repository';
import { DrizzleOutboxRepository } from '../persistence/outbox/drizzle.outbox-repository';
import { ensureSchema } from '../persistence/schema';
import {
  CLOCK,
  DRIZZLE_DB,
  EVENT_BUS,
  KNOWLEDGE_REPOSITORY,
  MEMORY_REPOSITORY,
  OUTBOX_POLLING_DRIVER,
  OUTBOX_PROCESSOR,
  OUTBOX_REPOSITORY,
  SQLITE_CONNECTION,
  UNIT_OF_WORK,
} from './tokens';

type DrizzleDB = ReturnType<typeof drizzle>;

const DB_PATH = process.env.DB_PATH ?? './data/sovereign.sqlite';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const OUTBOX_POLL_INTERVAL_MS = parsePositiveInt(process.env.OUTBOX_POLL_INTERVAL_MS, 5000);

function openConnection(): Database.Database {
  if (DB_PATH !== ':memory:') {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  const sqlite = new Database(DB_PATH);
  ensureSchema(sqlite);
  return sqlite;
}

export const persistenceProviders: Provider[] = [
  {
    provide: SQLITE_CONNECTION,
    useFactory: openConnection,
  },
  {
    provide: DRIZZLE_DB,
    useFactory: (sqlite: Database.Database) => drizzle(sqlite),
    inject: [SQLITE_CONNECTION],
  },
  {
    provide: UNIT_OF_WORK,
    useFactory: (db: DrizzleDB) => new DrizzleUnitOfWork(db),
    inject: [DRIZZLE_DB],
  },
  {
    provide: MEMORY_REPOSITORY,
    useFactory: (db: DrizzleDB) => new DrizzleMemoryRepository(db),
    inject: [DRIZZLE_DB],
  },
  {
    provide: KNOWLEDGE_REPOSITORY,
    useFactory: (db: DrizzleDB) => new DrizzleKnowledgeRepository(db),
    inject: [DRIZZLE_DB],
  },
  {
    provide: OUTBOX_REPOSITORY,
    useFactory: (db: DrizzleDB) => new DrizzleOutboxRepository(db),
    inject: [DRIZZLE_DB],
  },
  {
    provide: CLOCK,
    useFactory: () => new SystemClock(),
  },
  {
    provide: EVENT_BUS,
    useFactory: () => new DispatchingEventBus(),
  },
  {
    provide: OUTBOX_PROCESSOR,
    useFactory: (outbox: DrizzleOutboxRepository, eventBus: DispatchingEventBus) =>
      new OutboxProcessor(outbox, eventBus),
    inject: [OUTBOX_REPOSITORY, EVENT_BUS],
  },
  {
    provide: OUTBOX_POLLING_DRIVER,
    useFactory: (processor: OutboxProcessor) => {
      const logger = new Logger('OutboxPollingDriver');
      return new OutboxPollingDriver(processor, OUTBOX_POLL_INTERVAL_MS, (error) => {
        logger.error('OutboxPollingDriver tick failed', error);
      });
    },
    inject: [OUTBOX_PROCESSOR],
  },
];
