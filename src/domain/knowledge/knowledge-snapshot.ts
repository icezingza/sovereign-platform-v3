import { KnowledgeStatus } from './knowledge-status';

export interface KnowledgeSnapshot {
  readonly id: string;
  readonly content: string;
  readonly status: KnowledgeStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
