import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { MemoryRecord } from '../../../domain/memory/memory-record';
import { FakeClock } from '../../../domain/memory/time/fake-clock';
import { Importance } from '../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { DrizzleUnitOfWork } from '../../../infrastructure/persistence/drizzle.unit-of-work';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

const CREATE_MEMORY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS memory_records (
    id         TEXT    PRIMARY KEY,
    content    TEXT    NOT NULL,
    importance INTEGER NOT NULL,
    status     TEXT    NOT NULL,
    refs       TEXT    NOT NULL,
    version    INTEGER NOT NULL,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  )
`;

const CREATE_OUTBOX_TABLE_SQL = `
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

function setup() {
  const sqlite = new Database(':memory:');
  sqlite.exec(CREATE_MEMORY_TABLE_SQL);
  sqlite.exec(CREATE_OUTBOX_TABLE_SQL);
  const db = drizzle(sqlite);
  return { sqlite, db, unitOfWork: new DrizzleUnitOfWork(db) };
}

describe('DrizzleUnitOfWork', () => {
  it('commits both the memory save and the outbox append together', async () => {
    const { sqlite, unitOfWork } = setup();
    const clock = new FakeClock(BASE_DATE);
    const id = MemoryId.create(randomUUID());

    await unitOfWork.execute(async ({ repo, outbox }) => {
      const memory = MemoryRecord.create(id, 'hello', Importance.create(5), clock);
      await repo.save(memory);
      await outbox.append([
        {
          eventId: randomUUID(),
          aggregateId: id.value,
          eventType: 'MemoryCreated',
          occurredAt: BASE_DATE,
          schemaVersion: 1,
          payload: { content: 'hello' },
        },
      ]);
    });

    const memoryRow = sqlite.prepare('SELECT * FROM memory_records WHERE id = ?').get(id.value);
    const outboxRow = sqlite.prepare('SELECT * FROM outbox_events WHERE aggregate_id = ?').get(id.value);

    expect(memoryRow).toBeDefined();
    expect(outboxRow).toBeDefined();

    sqlite.close();
  });

  it('rolls back both the memory save and the outbox append when an error is thrown', async () => {
    const { sqlite, unitOfWork } = setup();
    const clock = new FakeClock(BASE_DATE);
    const id = MemoryId.create(randomUUID());

    await expect(
      unitOfWork.execute(async ({ repo, outbox }) => {
        const memory = MemoryRecord.create(id, 'hello', Importance.create(5), clock);
        await repo.save(memory);
        await outbox.append([
          {
            eventId: randomUUID(),
            aggregateId: id.value,
            eventType: 'MemoryCreated',
            occurredAt: BASE_DATE,
            schemaVersion: 1,
            payload: {},
          },
        ]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const memoryRow = sqlite.prepare('SELECT * FROM memory_records WHERE id = ?').get(id.value);
    const outboxRow = sqlite.prepare('SELECT * FROM outbox_events WHERE aggregate_id = ?').get(id.value);

    expect(memoryRow).toBeUndefined();
    expect(outboxRow).toBeUndefined();

    sqlite.close();
  });

  it('reads via repo.findById() inside the same unit of work see prior writes', async () => {
    const { sqlite, unitOfWork } = setup();
    const clock = new FakeClock(BASE_DATE);
    const id = MemoryId.create(randomUUID());

    await unitOfWork.execute(async ({ repo }) => {
      const memory = MemoryRecord.create(id, 'hello', Importance.create(5), clock);
      await repo.save(memory);

      const found = await repo.findById(id);
      expect(found).not.toBeNull();
      expect(found!.content).toBe('hello');
    });

    sqlite.close();
  });

  it('serializes concurrent execute() calls instead of interleaving BEGIN/COMMIT', async () => {
    const { sqlite, unitOfWork } = setup();
    const clock = new FakeClock(BASE_DATE);
    const ids = [MemoryId.create(randomUUID()), MemoryId.create(randomUUID())];

    await Promise.all(
      ids.map((id, index) =>
        unitOfWork.execute(async ({ repo, outbox }) => {
          const memory = MemoryRecord.create(id, `content-${index}`, Importance.create(5), clock);
          await repo.save(memory);
          await new Promise((resolve) => setImmediate(resolve));
          await outbox.append([
            {
              eventId: randomUUID(),
              aggregateId: id.value,
              eventType: 'MemoryCreated',
              occurredAt: BASE_DATE,
              schemaVersion: 1,
              payload: {},
            },
          ]);
        }),
      ),
    );

    for (const id of ids) {
      const memoryRow = sqlite.prepare('SELECT * FROM memory_records WHERE id = ?').get(id.value);
      const outboxRow = sqlite
        .prepare('SELECT * FROM outbox_events WHERE aggregate_id = ?')
        .get(id.value);
      expect(memoryRow).toBeDefined();
      expect(outboxRow).toBeDefined();
    }

    sqlite.close();
  });
});
