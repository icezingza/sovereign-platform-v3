import { UnitOfWork } from '../../ports/unit-of-work.interface';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { MemoryNotFoundError } from '../errors/application-error';
import { EventSerializer } from '../mappers/event-serializer';

export interface ForgetMemoryCommand {
  id: string;
}

export class ForgetMemoryHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: ForgetMemoryCommand): Promise<void> {
    await this.unitOfWork.execute(async ({ repo, outbox }) => {
      const id = MemoryId.create(command.id);
      const memory = await repo.findById(id);
      if (!memory) throw new MemoryNotFoundError(command.id);

      memory.forget(this.clock);

      await repo.save(memory);
      await outbox.append(EventSerializer.toOutboxEvents(memory.pullEvents()));
    });
  }
}
