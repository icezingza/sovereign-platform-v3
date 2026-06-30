import { UnitOfWork } from '../../ports/unit-of-work.interface';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';
import { MemoryNotFoundError } from '../errors/application-error';
import { EventSerializer } from '../mappers/event-serializer';
import { KnowledgeNotFoundError } from '../../knowledge/errors/application-error';

export interface LinkKnowledgeCommand {
  id: string;
  knowledgeId: string;
}

export class LinkKnowledgeHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: LinkKnowledgeCommand): Promise<void> {
    await this.unitOfWork.execute(async ({ repo, knowledgeRepo, outbox }) => {
      const id = MemoryId.create(command.id);
      const memory = await repo.findById(id);
      if (!memory) throw new MemoryNotFoundError(command.id);

      const knowledgeId = KnowledgeId.create(command.knowledgeId);
      const knowledge = await knowledgeRepo.findById(knowledgeId);
      if (!knowledge) throw new KnowledgeNotFoundError(command.knowledgeId);

      memory.linkKnowledge(knowledgeId, this.clock);

      await repo.save(memory);
      await outbox.append(EventSerializer.toOutboxEvents(memory.pullEvents()));
    });
  }
}
