import { ArchiveMemoryHandler } from '../../../application/memory/commands/archive-memory.handler';
import { CreateMemoryHandler } from '../../../application/memory/commands/create-memory.handler';
import { DeleteMemoryHandler } from '../../../application/memory/commands/delete-memory.handler';
import { ForgetMemoryHandler } from '../../../application/memory/commands/forget-memory.handler';
import { LinkKnowledgeHandler } from '../../../application/memory/commands/link-knowledge.handler';
import { RestoreMemoryHandler } from '../../../application/memory/commands/restore-memory.handler';
import { MemoryNotFoundError } from '../../../application/memory/errors/application-error';
import { MemoryRecord } from '../../../domain/memory/memory-record';
import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { MemoryStatus } from '../../../domain/memory/memory-status';
import { FakeClock } from '../../../domain/memory/time/fake-clock';
import { Importance } from '../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { InMemoryOutboxRepository } from '../../../infrastructure/persistence/outbox/in-memory.outbox-repository';
import { InMemoryUnitOfWork } from '../../../infrastructure/persistence/in-memory.unit-of-work';
import { InMemoryMemoryRepository } from '../../../infrastructure/persistence/memory/in-memory.memory-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

class FailingRepository implements MemoryRepository {
  private readonly delegate = new InMemoryMemoryRepository();

  async save(_memory: MemoryRecord): Promise<void> {
    throw new Error('save failed');
  }

  findById(id: MemoryId) {
    return this.delegate.findById(id);
  }

  delete(id: MemoryId) {
    return this.delegate.delete(id);
  }

  async seed(memory: MemoryRecord): Promise<void> {
    await this.delegate.save(memory);
  }
}

async function seedActiveMemory(
  repo: MemoryRepository,
  clock: FakeClock,
  id = 'm1',
): Promise<MemoryId> {
  const memoryId = MemoryId.create(id);
  const memory = MemoryRecord.create(memoryId, 'content', Importance.create(5), clock);
  memory.pullEvents();
  await repo.save(memory);
  return memoryId;
}

describe('Application Layer — Command Handlers', () => {
  let repo: InMemoryMemoryRepository;
  let outbox: InMemoryOutboxRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let clock: FakeClock;

  beforeEach(() => {
    repo = new InMemoryMemoryRepository();
    outbox = new InMemoryOutboxRepository();
    unitOfWork = new InMemoryUnitOfWork(repo, outbox);
    clock = new FakeClock(BASE_DATE);
  });

  describe('CreateMemoryHandler', () => {
    it('creates a memory, persists it, and appends MemoryCreated to the outbox', async () => {
      const handler = new CreateMemoryHandler(unitOfWork, clock);

      const id = await handler.execute({ content: 'Hello world', importance: 7 });

      const found = await repo.findById(id);
      expect(found).not.toBeNull();
      expect(found!.content).toBe('Hello world');
      expect(found!.importance.value).toBe(7);
      expect(found!.status).toBe(MemoryStatus.ACTIVE);

      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('MemoryCreated');
      expect(pending[0].aggregateId).toBe(id.value);
    });
  });

  describe('ArchiveMemoryHandler', () => {
    it('archives an existing memory and appends MemoryArchived to the outbox', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new ArchiveMemoryHandler(unitOfWork, clock);

      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.ARCHIVED);
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('MemoryArchived');
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new ArchiveMemoryHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
      expect(await outbox.findUnprocessed()).toHaveLength(0);
    });
  });

  describe('RestoreMemoryHandler', () => {
    it('restores an archived memory and appends MemoryRestored to the outbox', async () => {
      const id = await seedActiveMemory(repo, clock);
      const memory = await repo.findById(id);
      memory!.archive(clock);
      memory!.pullEvents();
      await repo.save(memory!);

      const handler = new RestoreMemoryHandler(unitOfWork, clock);
      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.ACTIVE);
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('MemoryRestored');
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new RestoreMemoryHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('ForgetMemoryHandler', () => {
    it('forgets an active memory and appends MemoryForgotten to the outbox', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new ForgetMemoryHandler(unitOfWork, clock);

      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.FORGOTTEN);
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('MemoryForgotten');
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new ForgetMemoryHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('DeleteMemoryHandler', () => {
    it('deletes an active memory and appends MemoryDeleted to the outbox', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new DeleteMemoryHandler(unitOfWork, clock);

      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.DELETED);
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('MemoryDeleted');
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new DeleteMemoryHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('LinkKnowledgeHandler', () => {
    it('links knowledge to a memory and appends KnowledgeLinked to the outbox', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new LinkKnowledgeHandler(unitOfWork, clock);

      await handler.execute({ id: id.value, knowledgeId: 'k1' });

      const found = await repo.findById(id);
      expect(found!.references).toHaveLength(1);
      expect(found!.references[0].value).toBe('k1');
      const pending = await outbox.findUnprocessed();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('KnowledgeLinked');
    });

    it('does not append a duplicate outbox event when linking the same knowledge twice', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new LinkKnowledgeHandler(unitOfWork, clock);

      await handler.execute({ id: id.value, knowledgeId: 'k1' });
      await handler.execute({ id: id.value, knowledgeId: 'k1' });

      const found = await repo.findById(id);
      expect(found!.references).toHaveLength(1);
      expect(await outbox.findUnprocessed()).toHaveLength(1);
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new LinkKnowledgeHandler(unitOfWork, clock);

      await expect(handler.execute({ id: 'nope', knowledgeId: 'k1' })).rejects.toThrow(
        MemoryNotFoundError,
      );
    });
  });

  describe('Transaction boundary', () => {
    it('does not append outbox events when save() fails', async () => {
      const failingRepo = new FailingRepository();
      const failingOutbox = new InMemoryOutboxRepository();
      const failingUnitOfWork = new InMemoryUnitOfWork(failingRepo, failingOutbox);

      const id = MemoryId.create('m-fail');
      const seeded = MemoryRecord.create(id, 'content', Importance.create(5), clock);
      seeded.pullEvents();
      await failingRepo.seed(seeded);

      const appendSpy = jest.spyOn(failingOutbox, 'append');
      const handler = new ArchiveMemoryHandler(failingUnitOfWork, clock);

      await expect(handler.execute({ id: id.value })).rejects.toThrow('save failed');

      expect(appendSpy).not.toHaveBeenCalled();
    });
  });
});
