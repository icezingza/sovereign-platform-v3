import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type Database from 'better-sqlite3';

import { OutboxPollingDriver } from '../../application/services/outbox-polling-driver';
import { OUTBOX_POLLING_DRIVER, SQLITE_CONNECTION } from './tokens';

@Injectable()
export class OutboxLifecycleService implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @Inject(OUTBOX_POLLING_DRIVER) private readonly pollingDriver: OutboxPollingDriver,
    @Inject(SQLITE_CONNECTION) private readonly sqlite: Database.Database,
  ) {}

  onApplicationBootstrap(): void {
    this.pollingDriver.start();
  }

  onApplicationShutdown(): void {
    this.pollingDriver.stop();
    this.sqlite.close();
  }
}
