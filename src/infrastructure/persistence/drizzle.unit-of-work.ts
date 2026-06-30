import { drizzle } from 'drizzle-orm/better-sqlite3';

import {
  UnitOfWork,
  UnitOfWorkContext,
} from '../../application/ports/unit-of-work.interface';
import { DrizzleOutboxRepository } from './outbox/drizzle.outbox-repository';
import { DrizzleMemoryRepository } from './memory/drizzle.memory-repository';

type DrizzleDB = ReturnType<typeof drizzle>;

/**
 * better-sqlite3's native `db.transaction()` wrapper only accepts a
 * synchronous callback, which is incompatible with the async UnitOfWork
 * contract (handlers need to `await findById()` before deciding what to
 * write next). better-sqlite3 is a single, synchronous connection, so
 * issuing BEGIN/COMMIT/ROLLBACK manually around an awaited async callback
 * gives the same atomicity guarantee without that constraint.
 */
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: DrizzleDB) {}

  async execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T> {
    const ctx: UnitOfWorkContext = {
      repo: new DrizzleMemoryRepository(this.db),
      outbox: new DrizzleOutboxRepository(this.db),
    };

    this.db.$client.exec('BEGIN');
    try {
      const result = await work(ctx);
      this.db.$client.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.$client.exec('ROLLBACK');
      throw error;
    }
  }
}
