import { ArchiveKnowledgeHandler } from '../../../application/knowledge/commands/archive-knowledge.handler';
import { CreateKnowledgeHandler } from '../../../application/knowledge/commands/create-knowledge.handler';
import { RestoreKnowledgeHandler } from '../../../application/knowledge/commands/restore-knowledge.handler';
import { KnowledgeNotFoundError } from '../../../application/knowledge/errors/application-error';
import { Knowledge } from '../../../domain/knowledge/knowledge';
import { KnowledgeRepository } from '../../../domain/knowledge/knowledge-repository.interface';
import { KnowledgeStatus } from '../../../domain/knowledge/knowledge-status';
import { FakeClock } from '../../../domain/memory/time/fake-clock';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { InMemoryOutboxRepository } from '../../../infrastructure/persistence/outbox/in-memory.outbox-repository';
import { InMemoryUnitOfWork } from '../../../infrastructure/persistence/in-memory.unit-of-work';
import { InMemoryKnowledgeRepository } from '../../../infrastructure/persistence/knowledge/in-memory.knowledge-repository';
import { InMemoryMemoryRepository } from '../../../infrastructure/persistence/memory/in-memory.memory-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

async function seedActiveKnowledge(
  repo: KnowledgeRepository,
  clock: FakeClock,
  id = 'k1',
): Promise<KnowledgeId> {
  const knowledgeId = KnowledgeId.create(id);
  const knowledge = Knowledge.create(knowledgeId, 'content', clock);
  knowledge.pullEvents();
  await repo.save(knowledge);
  return knowledgeId;
}

describe('Application Layer — Knowledge Command Handlers', () => {
  let knowledgeRepo: InMemoryKnowledgeRepository;
  let outbox: InMemoryOutboxRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let clock: FakeClock;

  beforeEach(() => {
    knowledgeRepo = new InMemoryKnowledgeRepository();
    outbox = new InMemoryOutboxRepository();
    unitOfWork = new InMemoryUnitOfWork(new InMemoryMemoryRepository(), outbox, knowledgeRepo);
    clock = new FakeClock(BASE_DATE);
  });

  describe('CreateKnowledgeHandler', () => {
    it('creates a knowledge entry, persists it, and appends KnowledgeCreated to the outbox', async () => {
      const handler = new CreateKnowledgeHandler(unitOfWork, clock);

      const id = await handler.execute({ content: 'Hello world' });

      const found = await knowledgeRepo.findById(id);
      expect(found).not.toBeNull();
      expect(found!.content).toBe('Hello world');
      expect(found!.status).toBe(KnowledgeStatus.ACTIVE);

      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('KnowledgeCreated');
      expect(pending[0].aggregateId).toBe(id.value);
    });
  });

  describe('ArchiveKnowledgeHandler', () => {
    it('archives an existing knowledge entry and appends KnowledgeArchived to the outbox', async () => {
      const id = await seedActiveKnowledge(knowledgeRepo, clock);
      const handler = new ArchiveKnowledgeHandler(unitOfWork, clock);

      await handler.execute({ id: id.value });

      const found = await knowledgeRepo.findById(id);
      expect(found!.status).toBe(KnowledgeStatus.ARCHIVED);
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('KnowledgeArchived');
    });

    it('throws KnowledgeNotFoundError for a non-existent id', async () => {
      const handler = new ArchiveKnowledgeHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(KnowledgeNotFoundError);
      expect(await outbox.findUnprocessed()).toHaveLength(0);
    });
  });

  describe('RestoreKnowledgeHandler', () => {
    it('restores an archived knowledge entry and appends KnowledgeRestored to the outbox', async () => {
      const id = await seedActiveKnowledge(knowledgeRepo, clock);
      const knowledge = await knowledgeRepo.findById(id);
      knowledge!.archive(clock);
      knowledge!.pullEvents();
      await knowledgeRepo.save(knowledge!);

      const handler = new RestoreKnowledgeHandler(unitOfWork, clock);
      await handler.execute({ id: id.value });

      const found = await knowledgeRepo.findById(id);
      expect(found!.status).toBe(KnowledgeStatus.ACTIVE);
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('KnowledgeRestored');
    });

    it('throws KnowledgeNotFoundError for a non-existent id', async () => {
      const handler = new RestoreKnowledgeHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(KnowledgeNotFoundError);
    });
  });
});
