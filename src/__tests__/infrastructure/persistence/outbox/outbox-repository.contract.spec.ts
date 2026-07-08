import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { OutboxEvent } from '../../../../application/ports/outbox-event';
import { OutboxRepository } from '../../../../application/ports/outbox-repository.interface';
import { DrizzleOutboxRepository } from '../../../../infrastructure/persistence/outbox/drizzle.outbox-repository';
import { InMemoryOutboxRepository } from '../../../../infrastructure/persistence/outbox/in-memory.outbox-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS outbox_events (
    event_id       TEXT    PRIMARY KEY,
    aggregate_id   TEXT    NOT NULL,
    event_type     TEXT    NOT NULL,
    payload        TEXT    NOT NULL,
    schema_version INTEGER NOT NULL,
    occurred_at    TEXT    NOT NULL,
    processed_at   TEXT
  )
`;

function makeEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    eventId: randomUUID(),
    aggregateId: randomUUID(),
    eventType: 'MemoryCreated',
    occurredAt: BASE_DATE,
    schemaVersion: 1,
    payload: { content: 'hello' },
    ...overrides,
  };
}

type RepoFactory = () => { repo: OutboxRepository; cleanup: () => void };

const factories: [string, RepoFactory][] = [
  [
    'InMemoryOutboxRepository',
    () => ({ repo: new InMemoryOutboxRepository(), cleanup: () => {} }),
  ],
  [
    'DrizzleOutboxRepository (SQLite :memory:)',
    () => {
      const sqlite = new Database(':memory:');
      sqlite.exec(CREATE_TABLE_SQL);
      const db = drizzle(sqlite);
      return {
        repo: new DrizzleOutboxRepository(db),
        cleanup: () => sqlite.close(),
      };
    },
  ],
];

describe.each(factories)('%s — Outbox Repository Contract', (_, factory) => {
  let repo: OutboxRepository;
  let cleanup: () => void = () => {};

  beforeEach(() => {
    ({ repo, cleanup } = factory());
  });

  afterEach(() => cleanup());

  it('append() then findUnprocessed() returns the appended event', async () => {
    const event = makeEvent();
    await repo.append([event]);

    const pending = await repo.findUnprocessed();

    expect(pending).toHaveLength(1);
    expect(pending[0].eventId).toBe(event.eventId);
    expect(pending[0].aggregateId).toBe(event.aggregateId);
    expect(pending[0].eventType).toBe(event.eventType);
    expect(pending[0].schemaVersion).toBe(1);
    expect(pending[0].payload).toEqual({ content: 'hello' });
    expect(pending[0].occurredAt.getTime()).toBe(BASE_DATE.getTime());
  });

  it('findUnprocessed() returns events ordered by occurredAt', async () => {
    const earlier = makeEvent({ occurredAt: new Date('2024-01-15T09:00:00.000Z') });
    const later = makeEvent({ occurredAt: new Date('2024-01-15T11:00:00.000Z') });
    await repo.append([later, earlier]);

    const pending = await repo.findUnprocessed();

    expect(pending.map((e) => e.eventId)).toEqual([earlier.eventId, later.eventId]);
  });

  it('findUnprocessed() respects the limit parameter', async () => {
    const events = [makeEvent(), makeEvent(), makeEvent()];
    await repo.append(events);

    const pending = await repo.findUnprocessed(2);

    expect(pending).toHaveLength(2);
  });

  it('markProcessed() excludes events from subsequent findUnprocessed() calls', async () => {
    const event = makeEvent();
    await repo.append([event]);

    await repo.markProcessed([event.eventId]);

    expect(await repo.findUnprocessed()).toHaveLength(0);
  });

  it('markProcessed() on an already-processed event is idempotent', async () => {
    const event = makeEvent();
    await repo.append([event]);

    await repo.markProcessed([event.eventId]);
    await expect(repo.markProcessed([event.eventId])).resolves.not.toThrow();

    expect(await repo.findUnprocessed()).toHaveLength(0);
  });

  it('append() with an empty array is a no-op', async () => {
    await expect(repo.append([])).resolves.not.toThrow();
    expect(await repo.findUnprocessed()).toHaveLength(0);
  });
});
