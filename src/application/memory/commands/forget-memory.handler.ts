import { EventBus } from '../../ports/event-bus.interface';
import { MemoryRepository } from '../../../domain/memory/memory-repository.interface';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { MemoryNotFoundError } from '../errors/application-error';

export interface ForgetMemoryCommand {
  id: string;
}

export class ForgetMemoryHandler {
  constructor(
    private readonly repo: MemoryRepository,
    private readonly eventBus: EventBus,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: ForgetMemoryCommand): Promise<void> {
    const id = MemoryId.create(command.id);
    const memory = await this.repo.findById(id);
    if (!memory) throw new MemoryNotFoundError(command.id);

    memory.forget(this.clock);

    await this.repo.save(memory);
    await this.eventBus.publish(memory.pullEvents());
  }
}
