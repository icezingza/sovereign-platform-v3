import { Knowledge } from './knowledge';
import { KnowledgeId } from '../memory/value-objects/knowledge-id';

export interface KnowledgeRepository {
  save(knowledge: Knowledge): Promise<void>;
  findById(id: KnowledgeId): Promise<Knowledge | null>;
  delete(id: KnowledgeId): Promise<void>;
}
