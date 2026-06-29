import { MemoryStatus } from './memory-status';

export interface MemorySnapshot {
  readonly id: string;
  readonly content: string;
  readonly importance: number;
  readonly status: MemoryStatus;
  readonly references: readonly string[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
