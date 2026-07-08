import { KnowledgeRepository } from '../../../domain/knowledge/knowledge-repository.interface';
import { KnowledgeSnapshot } from '../../../domain/knowledge/knowledge-snapshot';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';

export interface GetKnowledgeByIdQuery {
  id: string;
}

export class GetKnowledgeByIdHandler {
  constructor(private readonly repository: KnowledgeRepository) {}

  async execute(query: GetKnowledgeByIdQuery): Promise<KnowledgeSnapshot | null> {
    const knowledge = await this.repository.findById(KnowledgeId.create(query.id));
    return knowledge ? knowledge.toSnapshot() : null;
  }
}
