import { GetMemoryByIdHandler } from '../../../../application/memory/queries/get-memory-by-id.handler';
import { MemoryRecord } from '../../../../domain/memory/memory-record';
import { FakeClock } from '../../../../domain/memory/time/fake-clock';
import { Importance } from '../../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../../domain/memory/value-objects/memory-id';
import { InMemoryMemoryRepository } from '../../../../infrastructure/persistence/memory/in-memory.memory-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

describe('GetMemoryByIdHandler', () => {
  it('returns a MemorySnapshot matching the stored aggregate', async () => {
    const repo = new InMemoryMemoryRepository();
    const clock = new FakeClock(BASE_DATE);
    const id = MemoryId.create('m1');
    const memory = MemoryRecord.create(id, 'hello', Importance.create(5), clock);
    memory.pullEvents();
    await repo.save(memory);

    const handler = new GetMemoryByIdHandler(repo);
    const snapshot = await handler.execute({ id: 'm1' });

    expect(snapshot).toEqual(memory.toSnapshot());
  });

  it('returns null when no memory exists for the given id', async () => {
    const repo = new InMemoryMemoryRepository();
    const handler = new GetMemoryByIdHandler(repo);

    const snapshot = await handler.execute({ id: 'does-not-exist' });

    expect(snapshot).toBeNull();
  });
});
