import { randomUUID } from 'crypto';

import { UnitOfWork } from '../../ports/unit-of-work.interface';
import { Knowledge } from '../../../domain/knowledge/knowledge';
import { TimeProvider } from '../../../domain/memory/time/time-provider.interface';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { EventSerializer } from '../../memory/mappers/event-serializer';

export interface CreateKnowledgeCommand {
  content: string;
}

export class CreateKnowledgeHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: TimeProvider,
  ) {}

  async execute(command: CreateKnowledgeCommand): Promise<KnowledgeId> {
    const id = KnowledgeId.create(randomUUID());

    await this.unitOfWork.execute(async ({ knowledgeRepo, outbox }) => {
      const knowledge = Knowledge.create(id, command.content, this.clock);

      await knowledgeRepo.save(knowledge);
      await outbox.append(EventSerializer.toOutboxEvents(knowledge.pullEvents()));
    });

    return id;
  }
}
