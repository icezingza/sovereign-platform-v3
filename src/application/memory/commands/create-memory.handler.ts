import { randomUUID } from 'crypto';

import { UnitOfWork } from '../../ports/unit-of-work.interface';
import { MemoryRecord } from '../../../domain/memory/memory-record';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { Importance } from '../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { EventSerializer } from '../mappers/event-serializer';

export interface CreateMemoryCommand {
  content: string;
  importance: number;
}

export class CreateMemoryHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: CreateMemoryCommand): Promise<MemoryId> {
    const id = MemoryId.create(randomUUID());

    await this.unitOfWork.execute(async ({ repo, outbox }) => {
      const memory = MemoryRecord.create(
        id,
        command.content,
        Importance.create(command.importance),
        this.clock,
      );

      await repo.save(memory);
      await outbox.append(EventSerializer.toOutboxEvents(memory.pullEvents()));
    });

    return id;
  }
}
