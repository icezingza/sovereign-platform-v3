import { drizzle } from 'drizzle-orm/better-sqlite3';

import {
  UnitOfWork,
  UnitOfWorkContext,
} from '../../application/ports/unit-of-work.interface';
import { DrizzleOutboxRepository } from './outbox/drizzle.outbox-repository';
import { DrizzleKnowledgeRepository } from './knowledge/drizzle.knowledge-repository';
import { DrizzleMemoryRepository } from './memory/drizzle.memory-repository';

type DrizzleDB = ReturnType<typeof drizzle>;

/**
 * better-sqlite3's native `db.transaction()` wrapper only accepts a
 * synchronous callback, which is incompatible with the async UnitOfWork
 * contract (handlers need to `await findById()` before deciding what to
 * write next). better-sqlite3 is a single, synchronous connection, so
 * issuing BEGIN/COMMIT/ROLLBACK manually around an awaited async callback
 * gives the same atomicity guarantee without that constraint — but since
 * it's one connection, concurrent `execute()` calls must be serialized
 * via a promise queue or their BEGIN/COMMIT pairs would interleave.
 */
export class DrizzleUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: DrizzleDB) {}

  async execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T> {
    const ctx: UnitOfWorkContext = {
      repo: new DrizzleMemoryRepository(this.db),
      knowledgeRepo: new DrizzleKnowledgeRepository(this.db),
      outbox: new DrizzleOutboxRepository(this.db),
    };

    const run = async (): Promise<T> => {
      this.db.$client.exec('BEGIN');
      try {
        const result = await work(ctx);
        this.db.$client.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.db.$client.exec('ROLLBACK');
        } catch {
          // Original error from work(ctx) takes priority over a rollback failure.
        }
        throw error;
      }
    };

    const result = this.queue.then(run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
