import { ListMemoriesHandler } from '../../../../application/memory/queries/list-memories.handler';
import { MemoryRecord } from '../../../../domain/memory/memory-record';
import { MemoryStatus } from '../../../../domain/memory/memory-status';
import { FakeClock } from '../../../../domain/memory/time/fake-clock';
import { Importance } from '../../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../../domain/memory/value-objects/memory-id';
import { InMemoryMemoryRepository } from '../../../../infrastructure/persistence/memory/in-memory.memory-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

describe('ListMemoriesHandler', () => {
  it('returns an empty array when no memories exist', async () => {
    const repo = new InMemoryMemoryRepository();
    const handler = new ListMemoriesHandler(repo);

    expect(await handler.execute()).toEqual([]);
  });

  it('returns snapshots for all stored memories', async () => {
    const repo = new InMemoryMemoryRepository();
    const clock = new FakeClock(BASE_DATE);
    const memory = MemoryRecord.create(MemoryId.create('m1'), 'hello', Importance.create(5), clock);
    memory.pullEvents();
    await repo.save(memory);

    const handler = new ListMemoriesHandler(repo);
    const result = await handler.execute();

    expect(result).toEqual([memory.toSnapshot()]);
  });

  it('forwards the status filter to the repository', async () => {
    const repo = new InMemoryMemoryRepository();
    const clock = new FakeClock(BASE_DATE);
    const active = MemoryRecord.create(MemoryId.create('m1'), 'active', Importance.create(5), clock);
    await repo.save(active);
    const archived = MemoryRecord.create(MemoryId.create('m2'), 'archived', Importance.create(5), clock);
    archived.archive(clock);
    await repo.save(archived);

    const handler = new ListMemoriesHandler(repo);
    const result = await handler.execute({ status: MemoryStatus.ARCHIVED });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m2');
  });

  it('forwards the search filter to the repository', async () => {
    const repo = new InMemoryMemoryRepository();
    const clock = new FakeClock(BASE_DATE);
    const apple = MemoryRecord.create(MemoryId.create('m1'), 'I like apples', Importance.create(5), clock);
    await repo.save(apple);
    const banana = MemoryRecord.create(MemoryId.create('m2'), 'I like bananas', Importance.create(5), clock);
    await repo.save(banana);

    const handler = new ListMemoriesHandler(repo);
    const result = await handler.execute({ search: 'apple' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });
});
