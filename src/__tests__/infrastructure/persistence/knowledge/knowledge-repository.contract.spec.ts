import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { Knowledge } from '../../../../domain/knowledge/knowledge';
import { KnowledgeRepository } from '../../../../domain/knowledge/knowledge-repository.interface';
import { KnowledgeStatus } from '../../../../domain/knowledge/knowledge-status';
import { FakeClock } from '../../../../domain/memory/time/fake-clock';
import { KnowledgeId } from '../../../../domain/memory/value-objects/knowledge-id';
import { DrizzleKnowledgeRepository } from '../../../../infrastructure/persistence/knowledge/drizzle.knowledge-repository';
import { InMemoryKnowledgeRepository } from '../../../../infrastructure/persistence/knowledge/in-memory.knowledge-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_entries (
    id         TEXT    PRIMARY KEY,
    content    TEXT    NOT NULL,
    status     TEXT    NOT NULL,
    version    INTEGER NOT NULL,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  )
`;

function makeKnowledge(clock = new FakeClock(BASE_DATE)): Knowledge {
  return Knowledge.create(KnowledgeId.create(randomUUID()), 'Test knowledge', clock);
}

type RepoFactory = () => { repo: KnowledgeRepository; cleanup: () => void };

const factories: [string, RepoFactory][] = [
  [
    'InMemoryKnowledgeRepository',
    () => ({ repo: new InMemoryKnowledgeRepository(), cleanup: () => {} }),
  ],
  [
    'DrizzleKnowledgeRepository (SQLite :memory:)',
    () => {
      const sqlite = new Database(':memory:');
      sqlite.exec(CREATE_TABLE_SQL);
      const db = drizzle(sqlite);
      return {
        repo: new DrizzleKnowledgeRepository(db),
        cleanup: () => sqlite.close(),
      };
    },
  ],
];

describe.each(factories)('%s — Repository Contract', (_, factory) => {
  let repo: KnowledgeRepository;
  let cleanup: () => void = () => {};

  beforeEach(() => {
    ({ repo, cleanup } = factory());
  });

  afterEach(() => cleanup());

  it('save() then findById() returns a reconstituted aggregate', async () => {
    const clock = new FakeClock(BASE_DATE);
    const knowledge = makeKnowledge(clock);
    const id = knowledge.id;
    knowledge.pullEvents();

    await repo.save(knowledge);
    const found = await repo.findById(id);

    expect(found).not.toBeNull();
    expect(found!.id.equals(id)).toBe(true);
    expect(found!.status).toBe(KnowledgeStatus.ACTIVE);
    expect(found!.version).toBe(1);
    expect(found!.content).toBe('Test knowledge');
  });

  it('save() an updated aggregate overwrites the previous state', async () => {
    const clock = new FakeClock(BASE_DATE);
    const knowledge = makeKnowledge(clock);
    await repo.save(knowledge);

    knowledge.archive(clock);
    await repo.save(knowledge);

    const found = await repo.findById(knowledge.id);
    expect(found!.status).toBe(KnowledgeStatus.ARCHIVED);
    expect(found!.version).toBe(2);
  });

  it('findById() returns null for a non-existent id', async () => {
    const result = await repo.findById(KnowledgeId.create(randomUUID()));
    expect(result).toBeNull();
  });

  it('delete() removes the record so findById() returns null', async () => {
    const clock = new FakeClock(BASE_DATE);
    const knowledge = makeKnowledge(clock);
    await repo.save(knowledge);

    await repo.delete(knowledge.id);

    expect(await repo.findById(knowledge.id)).toBeNull();
  });

  it('delete() on a non-existent id is a no-op', async () => {
    await expect(repo.delete(KnowledgeId.create(randomUUID()))).resolves.not.toThrow();
  });

  it('all KnowledgeStatus values survive a round-trip', async () => {
    const clock = new FakeClock(BASE_DATE);

    const archived = makeKnowledge(clock);
    archived.archive(clock);
    await repo.save(archived);
    expect((await repo.findById(archived.id))!.status).toBe(KnowledgeStatus.ARCHIVED);

    const active = makeKnowledge(clock);
    await repo.save(active);
    expect((await repo.findById(active.id))!.status).toBe(KnowledgeStatus.ACTIVE);
  });

  it('timestamps survive a round-trip without precision loss', async () => {
    const clock = new FakeClock(BASE_DATE);
    const knowledge = makeKnowledge(clock);
    knowledge.pullEvents();

    await repo.save(knowledge);
    const found = await repo.findById(knowledge.id);

    expect(found!.createdAt.getTime()).toBe(BASE_DATE.getTime());
    expect(found!.updatedAt.getTime()).toBe(BASE_DATE.getTime());
  });

  it('reconstituted aggregate can continue state transitions', async () => {
    const clock = new FakeClock(BASE_DATE);
    const knowledge = makeKnowledge(clock);
    knowledge.archive(clock);
    await repo.save(knowledge);

    const found = await repo.findById(knowledge.id);
    found!.restore(clock);

    expect(found!.status).toBe(KnowledgeStatus.ACTIVE);
    expect(found!.version).toBe(3);
    expect(found!.pullEvents()).toHaveLength(1);
  });

  it('save() does not pull or mutate pending events on the aggregate', async () => {
    const clock = new FakeClock(BASE_DATE);
    const knowledge = makeKnowledge(clock);

    await repo.save(knowledge);

    const events = knowledge.pullEvents();
    expect(events).toHaveLength(1);
  });

  describe('findAll()', () => {
    it('returns an empty array when no entries exist', async () => {
      expect(await repo.findAll()).toEqual([]);
    });

    it('returns entries ordered by createdAt descending by default', async () => {
      const clock = new FakeClock(BASE_DATE);
      const first = makeKnowledge(clock);
      await repo.save(first);
      clock.tick(1000);
      const second = makeKnowledge(clock);
      await repo.save(second);
      clock.tick(1000);
      const third = makeKnowledge(clock);
      await repo.save(third);

      const found = await repo.findAll();

      expect(found.map((k) => k.id.value)).toEqual([third.id.value, second.id.value, first.id.value]);
    });

    it('filters by status', async () => {
      const clock = new FakeClock(BASE_DATE);
      const active = makeKnowledge(clock);
      await repo.save(active);
      const archived = makeKnowledge(clock);
      archived.archive(clock);
      await repo.save(archived);

      const found = await repo.findAll({ status: KnowledgeStatus.ARCHIVED });

      expect(found).toHaveLength(1);
      expect(found[0].id.value).toBe(archived.id.value);
    });

    it('respects limit and offset', async () => {
      const clock = new FakeClock(BASE_DATE);
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const knowledge = makeKnowledge(clock);
        ids.unshift(knowledge.id.value);
        await repo.save(knowledge);
        clock.tick(1000);
      }

      const page = await repo.findAll({ limit: 2, offset: 1 });

      expect(page.map((k) => k.id.value)).toEqual(ids.slice(1, 3));
    });

    it('filters by content search (case-insensitive substring)', async () => {
      const clock = new FakeClock(BASE_DATE);
      const apple = Knowledge.create(KnowledgeId.create(randomUUID()), 'I like apples', clock);
      await repo.save(apple);
      const banana = Knowledge.create(KnowledgeId.create(randomUUID()), 'I like bananas', clock);
      await repo.save(banana);

      const found = await repo.findAll({ search: 'APPLE' });

      expect(found).toHaveLength(1);
      expect(found[0].id.value).toBe(apple.id.value);
    });

    it('combines status filter and content search', async () => {
      const clock = new FakeClock(BASE_DATE);
      const activeApple = Knowledge.create(KnowledgeId.create(randomUUID()), 'apple pie', clock);
      await repo.save(activeApple);
      const archivedApple = Knowledge.create(KnowledgeId.create(randomUUID()), 'apple tart', clock);
      archivedApple.archive(clock);
      await repo.save(archivedApple);

      const found = await repo.findAll({ status: KnowledgeStatus.ARCHIVED, search: 'apple' });

      expect(found).toHaveLength(1);
      expect(found[0].id.value).toBe(archivedApple.id.value);
    });
  });
});
