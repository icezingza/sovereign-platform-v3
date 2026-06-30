import { GetKnowledgeByIdHandler } from '../../../../application/knowledge/queries/get-knowledge-by-id.handler';
import { Knowledge } from '../../../../domain/knowledge/knowledge';
import { FakeClock } from '../../../../domain/memory/time/fake-clock';
import { KnowledgeId } from '../../../../domain/memory/value-objects/knowledge-id';
import { InMemoryKnowledgeRepository } from '../../../../infrastructure/persistence/knowledge/in-memory.knowledge-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

describe('GetKnowledgeByIdHandler', () => {
  it('returns a KnowledgeSnapshot matching the stored aggregate', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const clock = new FakeClock(BASE_DATE);
    const id = KnowledgeId.create('k1');
    const knowledge = Knowledge.create(id, 'hello', clock);
    knowledge.pullEvents();
    await repo.save(knowledge);

    const handler = new GetKnowledgeByIdHandler(repo);
    const snapshot = await handler.execute({ id: 'k1' });

    expect(snapshot).toEqual(knowledge.toSnapshot());
  });

  it('returns null when no knowledge exists for the given id', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const handler = new GetKnowledgeByIdHandler(repo);

    const snapshot = await handler.execute({ id: 'does-not-exist' });

    expect(snapshot).toBeNull();
  });
});
