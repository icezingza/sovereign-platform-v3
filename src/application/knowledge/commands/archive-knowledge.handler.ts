import { UnitOfWork } from '../../ports/unit-of-work.interface';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { EventSerializer } from '../../memory/mappers/event-serializer';
import { KnowledgeNotFoundError } from '../errors/application-error';

export interface ArchiveKnowledgeCommand {
  id: string;
}

export class ArchiveKnowledgeHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: ArchiveKnowledgeCommand): Promise<void> {
    await this.unitOfWork.execute(async ({ knowledgeRepo, outbox }) => {
      const id = KnowledgeId.create(command.id);
      const knowledge = await knowledgeRepo.findById(id);
      if (!knowledge) throw new KnowledgeNotFoundError(command.id);

      knowledge.archive(this.clock);

      await knowledgeRepo.save(knowledge);
      await outbox.append(EventSerializer.toOutboxEvents(knowledge.pullEvents()));
    });
  }
}
