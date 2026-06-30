import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { MemoryRecord } from '../../../../domain/memory/memory-record';
import { MemoryRepository } from '../../../../domain/memory/memory-repository.interface';
import { MemoryStatus } from '../../../../domain/memory/memory-status';
import { FakeClock } from '../../../../domain/memory/time/fake-clock';
import { Importance } from '../../../../domain/memory/value-objects/importance';
import { KnowledgeId } from '../../../../domain/memory/value-objects/knowledge-id';
import { MemoryId } from '../../../../domain/memory/value-objects/memory-id';
import { DrizzleMemoryRepository } from '../../../../infrastructure/persistence/memory/drizzle.memory-repository';
import { InMemoryMemoryRepository } from '../../../../infrastructure/persistence/memory/in-memory.memory-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

const CREATE_TABLE_SQL = `
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

function makeMemory(clock = new FakeClock(BASE_DATE)): MemoryRecord {
  return MemoryRecord.create(
    MemoryId.create(randomUUID()),
    'Test memory',
    Importance.create(5),
    clock,
  );
}

type RepoFactory = () => { repo: MemoryRepository; cleanup: () => void };

const factories: [string, RepoFactory][] = [
  [
    'InMemoryMemoryRepository',
    () => ({ repo: new InMemoryMemoryRepository(), cleanup: () => {} }),
  ],
  [
    'DrizzleMemoryRepository (SQLite :memory:)',
    () => {
      const sqlite = new Database(':memory:');
      sqlite.exec(CREATE_TABLE_SQL);
      const db = drizzle(sqlite);
      return {
        repo: new DrizzleMemoryRepository(db),
        cleanup: () => sqlite.close(),
      };
    },
  ],
];

describe.each(factories)('%s — Repository Contract', (_, factory) => {
  let repo: MemoryRepository;
  let cleanup: () => void = () => {};

  beforeEach(() => {
    ({ repo, cleanup } = factory());
  });

  afterEach(() => cleanup());

  it('save() then findById() returns a reconstituted aggregate', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);
    const id = memory.id;
    memory.pullEvents();

    await repo.save(memory);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id.equals(id)).toBe(true);
    expect(found!.status).toBe(MemoryStatus.ACTIVE);
    expect(found!.version).toBe(1);
    expect(found!.content).toBe('Test memory');
    expect(found!.importance.value).toBe(5);
  });

  it('save() an updated aggregate overwrites the previous state', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);
    await repo.save(memory);

    memory.archive(clock);
    await repo.save(memory);

    const found = await repo.findById(memory.id);
    expect(found!.status).toBe(MemoryStatus.ARCHIVED);
    expect(found!.version).toBe(2);
  });

  it('findById() returns null for a non-existent id', async () => {
    const result = await repo.findById(MemoryId.create(randomUUID()));
    expect(result).toBeNull();
  });

  it('delete() removes the record so findById() returns null', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);
    await repo.save(memory);

    await repo.delete(memory.id);

    expect(await repo.findById(memory.id)).toBeNull();
  });

  it('delete() on a non-existent id is a no-op', async () => {
    await expect(repo.delete(MemoryId.create(randomUUID()))).resolves.not.toThrow();
  });

  it('references round-trip correctly', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);
    memory.linkKnowledge(KnowledgeId.create('k1'), clock);
    memory.linkKnowledge(KnowledgeId.create('k2'), clock);
    memory.pullEvents();

    await repo.save(memory);
    const found = await repo.findById(memory.id);

    expect(found!.references).toHaveLength(2);
    expect(found!.references[0].value).toBe('k1');
    expect(found!.references[1].value).toBe('k2');
  });

  it('all MemoryStatus values survive a round-trip', async () => {
    const clock = new FakeClock(BASE_DATE);

    const archived = makeMemory(clock);
    archived.archive(clock);
    await repo.save(archived);
    expect((await repo.findById(archived.id))!.status).toBe(MemoryStatus.ARCHIVED);

    const forgotten = makeMemory(clock);
    forgotten.forget(clock);
    await repo.save(forgotten);
    expect((await repo.findById(forgotten.id))!.status).toBe(MemoryStatus.FORGOTTEN);

    const deleted = makeMemory(clock);
    deleted.delete(clock);
    await repo.save(deleted);
    expect((await repo.findById(deleted.id))!.status).toBe(MemoryStatus.DELETED);
  });

  it('timestamps survive a round-trip without precision loss', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);
    memory.pullEvents();

    await repo.save(memory);
    const found = await repo.findById(memory.id);

    expect(found!.createdAt.getTime()).toBe(BASE_DATE.getTime());
    expect(found!.updatedAt.getTime()).toBe(BASE_DATE.getTime());
  });

  it('reconstituted aggregate can continue state transitions', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);
    memory.archive(clock);
    await repo.save(memory);

    const found = await repo.findById(memory.id);
    found!.restore(clock);

    expect(found!.status).toBe(MemoryStatus.ACTIVE);
    expect(found!.version).toBe(3);
    expect(found!.pullEvents()).toHaveLength(1);
  });

  it('save() does not pull or mutate pending events on the aggregate', async () => {
    const clock = new FakeClock(BASE_DATE);
    const memory = makeMemory(clock);

    await repo.save(memory);

    const events = memory.pullEvents();
    expect(events).toHaveLength(1);
  });

  describe('findAll()', () => {
    it('returns an empty array when no records exist', async () => {
      expect(await repo.findAll()).toEqual([]);
    });

    it('returns records ordered by createdAt descending by default', async () => {
      const clock = new FakeClock(BASE_DATE);
      const first = makeMemory(clock);
      await repo.save(first);
      clock.tick(1000);
      const second = makeMemory(clock);
      await repo.save(second);
      clock.tick(1000);
      const third = makeMemory(clock);
      await repo.save(third);

      const found = await repo.findAll();

      expect(found.map((m) => m.id.value)).toEqual([third.id.value, second.id.value, first.id.value]);
    });

    it('filters by status', async () => {
      const clock = new FakeClock(BASE_DATE);
      const active = makeMemory(clock);
      await repo.save(active);
      const archived = makeMemory(clock);
      archived.archive(clock);
      await repo.save(archived);

      const found = await repo.findAll({ status: MemoryStatus.ARCHIVED });

      expect(found).toHaveLength(1);
      expect(found[0].id.value).toBe(archived.id.value);
    });

    it('respects limit and offset', async () => {
      const clock = new FakeClock(BASE_DATE);
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const memory = makeMemory(clock);
        ids.unshift(memory.id.value);
        await repo.save(memory);
        clock.tick(1000);
      }

      const page = await repo.findAll({ limit: 2, offset: 1 });

      expect(page.map((m) => m.id.value)).toEqual(ids.slice(1, 3));
    });

    it('filters by content search (case-insensitive substring)', async () => {
      const clock = new FakeClock(BASE_DATE);
      const apple = MemoryRecord.create(
        MemoryId.create(randomUUID()),
        'I like apples',
        Importance.create(5),
        clock,
      );
      await repo.save(apple);
      const banana = MemoryRecord.create(
        MemoryId.create(randomUUID()),
        'I like bananas',
        Importance.create(5),
        clock,
      );
      await repo.save(banana);

      const found = await repo.findAll({ search: 'APPLE' });

      expect(found).toHaveLength(1);
      expect(found[0].id.value).toBe(apple.id.value);
    });

    it('combines status filter and content search', async () => {
      const clock = new FakeClock(BASE_DATE);
      const activeApple = MemoryRecord.create(
        MemoryId.create(randomUUID()),
        'apple pie',
        Importance.create(5),
        clock,
      );
      await repo.save(activeApple);
      const archivedApple = MemoryRecord.create(
        MemoryId.create(randomUUID()),
        'apple tart',
        Importance.create(5),
        clock,
      );
      archivedApple.archive(clock);
      await repo.save(archivedApple);

      const found = await repo.findAll({ status: MemoryStatus.ARCHIVED, search: 'apple' });

      expect(found).toHaveLength(1);
      expect(found[0].id.value).toBe(archivedApple.id.value);
    });
  });
});
