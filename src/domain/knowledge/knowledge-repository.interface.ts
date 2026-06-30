import { Knowledge } from './knowledge';
import { KnowledgeStatus } from './knowledge-status';
import { KnowledgeId } from '../memory/value-objects/knowledge-id';

export interface ListKnowledgeOptions {
  status?: KnowledgeStatus;
  limit?: number;
  offset?: number;
}

export interface KnowledgeRepository {
  save(knowledge: Knowledge): Promise<void>;
  findById(id: KnowledgeId): Promise<Knowledge | null>;
  delete(id: KnowledgeId): Promise<void>;
  findAll(options?: ListKnowledgeOptions): Promise<Knowledge[]>;
}
