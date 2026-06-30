import { randomUUID } from 'crypto';

import { EventBus } from '../../ports/event-bus.interface';
import { MemoryRecord } from '../../../domain/memory/memory-record';
import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { Importance } from '../../../domain/memory/value-objects/importance';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';

export interface CreateMemoryCommand {
  content: string;
  importance: number;
}

export class CreateMemoryHandler {
  constructor(
    private readonly repo: MemoryRepository,
    private readonly eventBus: EventBus,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: CreateMemoryCommand): Promise<MemoryId> {
    const id = MemoryId.create(randomUUID());
    const memory = MemoryRecord.create(
      id,
      command.content,
      Importance.create(command.importance),
      this.clock,
    );

    await this.repo.save(memory);
    await this.eventBus.publish(memory.pullEvents());

    return id;
  }
}
