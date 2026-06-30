import type Database from 'better-sqlite3';

/**
 * No migration tooling exists yet (Sprint 2.5/2.7 introduced the Drizzle
 * schemas but only ever created tables ad hoc inside tests). The
 * composition root needs the same tables to exist against a real file,
 * so this mirrors the exact DDL the contract/unit-of-work tests already
 * use rather than inventing a new migration system for one call site.
 */
export function ensureSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS memory_records (
      id         TEXT    PRIMARY KEY,
      content    TEXT    NOT NULL,
      importance INTEGER NOT NULL,
      status     TEXT    NOT NULL,
      refs       TEXT    NOT NULL,
      version    INTEGER NOT NULL,
      created_at TEXT    NOT NULL,
      updated_at TEXT    NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS outbox_events (
      event_id       TEXT    PRIMARY KEY,
      aggregate_id   TEXT    NOT NULL,
      event_type     TEXT    NOT NULL,
      payload        TEXT    NOT NULL,
      schema_version INTEGER NOT NULL,
      occurred_at    TEXT    NOT NULL,
      processed_at   TEXT
    )
  `);
}
