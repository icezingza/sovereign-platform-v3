import {
  KnowledgeRepository,
  ListKnowledgeOptions,
} from '../../../domain/knowledge/knowledge-repository.interface';
import { KnowledgeSnapshot } from '../../../domain/knowledge/knowledge-snapshot';

export type ListKnowledgeQuery = ListKnowledgeOptions;

export class ListKnowledgeHandler {
  constructor(private readonly repository: KnowledgeRepository) {}

  async execute(query: ListKnowledgeQuery = {}): Promise<KnowledgeSnapshot[]> {
    const entries = await this.repository.findAll(query);
    return entries.map((entry) => entry.toSnapshot());
  }
}
