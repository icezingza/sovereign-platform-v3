# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-07-09

First public release. A complete, tested AI memory & cognition engine — usable as a TypeScript library or as a standalone REST API.

### Domain

- `MemoryRecord` aggregate with a strict lifecycle state machine (`ACTIVE → ARCHIVED → FORGOTTEN/DELETED`), version increment + domain event + timestamp on every mutation, and no setters — state changes only through behavior methods. Invalid transitions throw `InvalidStateTransitionError` before mutating any field.
- `Knowledge` aggregate (`ACTIVE ↔ ARCHIVED`) as the target of memory references.
- Idempotent `linkKnowledge()` with value-equality deduplication.
- Value objects: `MemoryId`, `KnowledgeId`, `Importance` (integer 1–10).
- Snapshot/reconstitute pattern: `toSnapshot()` returns a frozen DTO; `reconstitute()` rebuilds silently (no events).
- Injectable `TimeProvider` (`SystemClock` / `FakeClock`) for deterministic time.

### Application

- 9 command handlers (create/archive/restore/forget/delete/link for Memory; create/archive/restore for Knowledge), each running inside a transactional `UnitOfWork`.
- `LinkKnowledgeHandler` validates the linked knowledge exists before linking.
- Query side: `GetMemoryByIdHandler`, `GetKnowledgeByIdHandler`, `ListMemoriesHandler`, `ListKnowledgeHandler` — status filter, case-insensitive content search, limit/offset pagination.
- **Transactional Outbox**: aggregate save + event append are atomic; `OutboxProcessor` + `OutboxPollingDriver` deliver events to registered `EventConsumer`s via `DispatchingEventBus`.

### Infrastructure

- Two adapters per port, verified by shared contract tests: in-memory (zero-setup dev/tests) and Drizzle + better-sqlite3 (production).
- `DrizzleUnitOfWork` with real `BEGIN`/`COMMIT`/`ROLLBACK` semantics and serialized execution.
- NestJS composition root exposing the full REST API (`/memories`, `/knowledge`) with clean error mapping (404 / 409 / 400); domain and application layers stay 100% framework-free.
- `ensureSchema()` bootstrap for SQLite tables.

### Quality

- 209 tests: domain behavior matrix, repository contract tests against both adapters, transaction rollback verification, outbox processing, and end-to-end HTTP tests booting the real composition root.
- CI on Node 18 and 20 (typecheck + full test suite).

[0.1.0]: https://github.com/icezingza/sovereign-platform-v3/releases/tag/v0.1.0
