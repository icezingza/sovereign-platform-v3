import { KnowledgeSnapshot } from '../../../../domain/knowledge/knowledge-snapshot';
import { KnowledgeStatus } from '../../../../domain/knowledge/knowledge-status';
import { KnowledgeRow, NewKnowledgeRow } from '../schema/knowledge-entries.schema';

export class KnowledgeMapper {
  static toRow(snapshot: KnowledgeSnapshot): NewKnowledgeRow {
    return {
      id: snapshot.id,
      content: snapshot.content,
      status: snapshot.status,
      version: snapshot.version,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  static toSnapshot(row: KnowledgeRow): KnowledgeSnapshot {
    return {
      id: row.id,
      content: row.content,
      status: row.status as KnowledgeStatus,
      version: row.version,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
