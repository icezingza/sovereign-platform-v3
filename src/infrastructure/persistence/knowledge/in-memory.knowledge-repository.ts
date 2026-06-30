import { Knowledge } from '../../../domain/knowledge/knowledge';
import { KnowledgeRepository } from '../../../domain/knowledge/knowledge-repository.interface';
import { KnowledgeSnapshot } from '../../../domain/knowledge/knowledge-snapshot';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly store = new Map<string, KnowledgeSnapshot>();

  async save(knowledge: Knowledge): Promise<void> {
    this.store.set(knowledge.id.value, knowledge.toSnapshot());
  }

  async findById(id: KnowledgeId): Promise<Knowledge | null> {
    const snapshot = this.store.get(id.value);
    if (!snapshot) return null;
    return Knowledge.reconstitute(snapshot);
  }

  async delete(id: KnowledgeId): Promise<void> {
    this.store.delete(id.value);
  }
}
