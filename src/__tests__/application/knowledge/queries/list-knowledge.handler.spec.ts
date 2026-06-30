import { ListKnowledgeHandler } from '../../../../application/knowledge/queries/list-knowledge.handler';
import { Knowledge } from '../../../../domain/knowledge/knowledge';
import { KnowledgeStatus } from '../../../../domain/knowledge/knowledge-status';
import { FakeClock } from '../../../../domain/memory/time/fake-clock';
import { KnowledgeId } from '../../../../domain/memory/value-objects/knowledge-id';
import { InMemoryKnowledgeRepository } from '../../../../infrastructure/persistence/knowledge/in-memory.knowledge-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

describe('ListKnowledgeHandler', () => {
  it('returns an empty array when no entries exist', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const handler = new ListKnowledgeHandler(repo);

    expect(await handler.execute()).toEqual([]);
  });

  it('returns snapshots for all stored entries', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const clock = new FakeClock(BASE_DATE);
    const knowledge = Knowledge.create(KnowledgeId.create('k1'), 'hello', clock);
    knowledge.pullEvents();
    await repo.save(knowledge);

    const handler = new ListKnowledgeHandler(repo);
    const result = await handler.execute();

    expect(result).toEqual([knowledge.toSnapshot()]);
  });

  it('forwards the status filter to the repository', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const clock = new FakeClock(BASE_DATE);
    const active = Knowledge.create(KnowledgeId.create('k1'), 'active', clock);
    await repo.save(active);
    const archived = Knowledge.create(KnowledgeId.create('k2'), 'archived', clock);
    archived.archive(clock);
    await repo.save(archived);

    const handler = new ListKnowledgeHandler(repo);
    const result = await handler.execute({ status: KnowledgeStatus.ARCHIVED });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('k2');
  });
});
