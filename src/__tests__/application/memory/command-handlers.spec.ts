import { ArchiveMemoryHandler } from '../../../application/memory/commands/archive-memory.handler';
import { CreateMemoryHandler } from '../../../application/memory/commands/create-memory.handler';
import { DeleteMemoryHandler } from '../../../application/memory/commands/delete-memory.handler';
import { ForgetMemoryHandler } from '../../../application/memory/commands/forget-memory.handler';
import { LinkKnowledgeHandler } from '../../../application/memory/commands/link-knowledge.handler';
import { RestoreMemoryHandler } from '../../../application/memory/commands/restore-memory.handler';
import { MemoryNotFoundError } from '../../../application/memory/errors/application-error';
import { KnowledgeLinkedEvent } from '../../../domain/memory/events/knowledge-linked.event';
import { MemoryArchivedEvent } from '../../../domain/memory/events/memory-archived.event';
import { MemoryCreatedEvent } from '../../../domain/memory/events/memory-created.event';
import { MemoryDeletedEvent } from '../../../domain/memory/events/memory-deleted.event';
import { MemoryForgottenEvent } from '../../../domain/memory/events/memory-forgotten.event';
import { MemoryRestoredEvent } from '../../../domain/memory/events/memory-restored.event';
import { MemoryRecord } from '../../../domain/memory/memory-record';
import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { MemoryStatus } from '../../../domain/memory/memory-status';
import { FakeClock } from '../../../domain/memory/time/fake-clock';
import { Importance } from '../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { InMemoryEventBus } from '../../../infrastructure/events/in-memory.event-bus';
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
  let eventBus: InMemoryEventBus;
  let clock: FakeClock;

  beforeEach(() => {
    repo = new InMemoryMemoryRepository();
    eventBus = new InMemoryEventBus();
    clock = new FakeClock(BASE_DATE);
  });

  describe('CreateMemoryHandler', () => {
    it('creates a memory, persists it, and publishes MemoryCreatedEvent', async () => {
      const handler = new CreateMemoryHandler(repo, eventBus, clock);

      const id = await handler.execute({ content: 'Hello world', importance: 7 });

      const found = await repo.findById(id);
      expect(found).not.toBeNull();
      expect(found!.content).toBe('Hello world');
      expect(found!.importance.value).toBe(7);
      expect(found!.status).toBe(MemoryStatus.ACTIVE);

      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(MemoryCreatedEvent);
    });
  });

  describe('ArchiveMemoryHandler', () => {
    it('archives an existing memory and publishes MemoryArchivedEvent', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new ArchiveMemoryHandler(repo, eventBus, clock);

      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.ARCHIVED);
      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(MemoryArchivedEvent);
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new ArchiveMemoryHandler(repo, eventBus, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
      expect(eventBus.events).toHaveLength(0);
    });
  });

  describe('RestoreMemoryHandler', () => {
    it('restores an archived memory and publishes MemoryRestoredEvent', async () => {
      const id = await seedActiveMemory(repo, clock);
      const memory = await repo.findById(id);
      memory!.archive(clock);
      memory!.pullEvents();
      await repo.save(memory!);

      const handler = new RestoreMemoryHandler(repo, eventBus, clock);
      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.ACTIVE);
      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(MemoryRestoredEvent);
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new RestoreMemoryHandler(repo, eventBus, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('ForgetMemoryHandler', () => {
    it('forgets an active memory and publishes MemoryForgottenEvent', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new ForgetMemoryHandler(repo, eventBus, clock);

      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.FORGOTTEN);
      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(MemoryForgottenEvent);
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new ForgetMemoryHandler(repo, eventBus, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('DeleteMemoryHandler', () => {
    it('deletes an active memory and publishes MemoryDeletedEvent', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new DeleteMemoryHandler(repo, eventBus, clock);

      await handler.execute({ id: id.value });

      const found = await repo.findById(id);
      expect(found!.status).toBe(MemoryStatus.DELETED);
      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(MemoryDeletedEvent);
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new DeleteMemoryHandler(repo, eventBus, clock);

      await expect(handler.execute({ id: 'nope' })).rejects.toThrow(MemoryNotFoundError);
    });
  });

  describe('LinkKnowledgeHandler', () => {
    it('links knowledge to a memory and publishes KnowledgeLinkedEvent', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new LinkKnowledgeHandler(repo, eventBus, clock);

      await handler.execute({ id: id.value, knowledgeId: 'k1' });

      const found = await repo.findById(id);
      expect(found!.references).toHaveLength(1);
      expect(found!.references[0].value).toBe('k1');
      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0]).toBeInstanceOf(KnowledgeLinkedEvent);
    });

    it('does not publish a duplicate event when linking the same knowledge twice', async () => {
      const id = await seedActiveMemory(repo, clock);
      const handler = new LinkKnowledgeHandler(repo, eventBus, clock);

      await handler.execute({ id: id.value, knowledgeId: 'k1' });
      await handler.execute({ id: id.value, knowledgeId: 'k1' });

      const found = await repo.findById(id);
      expect(found!.references).toHaveLength(1);
      expect(eventBus.events).toHaveLength(1);
    });

    it('throws MemoryNotFoundError for a non-existent id', async () => {
      const handler = new LinkKnowledgeHandler(repo, eventBus, clock);

      await expect(handler.execute({ id: 'nope', knowledgeId: 'k1' })).rejects.toThrow(
        MemoryNotFoundError,
      );
    });
  });

  describe('Transaction boundary', () => {
    it('does not publish events when save() fails', async () => {
      const failingRepo = new FailingRepository();
      const id = MemoryId.create('m-fail');
      const seeded = MemoryRecord.create(id, 'content', Importance.create(5), clock);
      seeded.pullEvents();
      await failingRepo.seed(seeded);

      const publishSpy = jest.spyOn(eventBus, 'publish');
      const handler = new ArchiveMemoryHandler(failingRepo, eventBus, clock);

      await expect(handler.execute({ id: id.value })).rejects.toThrow('save failed');

      expect(publishSpy).not.toHaveBeenCalled();
    });
  });
});
