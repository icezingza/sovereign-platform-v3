# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NaMo Sovereign Platform v3** — A DDD-based AI memory and cognition system. The codebase is structured as a TypeScript monorepo (planned). Sprint 2.4 delivers the frozen `MemoryRecord` aggregate; Sprint 2.5+ will add persistence, application layer, and event bus.

## Commands

```bash
npm test                          # run all tests
npm run test:watch                # watch mode
npm run test:single -- <pattern>  # run one file, e.g. memory-record
npm run test:coverage             # coverage report
npm run typecheck                 # type-check without emitting
```

## Architecture

### Layer Boundaries (strictly enforced)

```
Domain  ←  Application  ←  Infrastructure
  ↑
nothing (domain has zero outward dependencies)
```

- **Domain** knows nothing about ORM, HTTP, NestJS, or any framework.
- **Application layer** orchestrates only — no business logic. After `repository.save(memory)` it calls `eventBus.publish(memory.pullEvents())`.
- **Repository interface** accepts `MemoryRecord` (the aggregate), not `MemorySnapshot`. The adapter calls `toSnapshot()` internally.

### Domain: MemoryRecord Aggregate (Sprint 2.4 — frozen)

Location: `src/domain/memory/`

```
memory/
├── memory-record.ts          # Aggregate Root
├── memory-snapshot.ts        # DTO boundary for persistence
├── memory-status.ts          # Enum: ACTIVE | ARCHIVED | FORGOTTEN | DELETED
├── errors/domain-error.ts    # DomainError, InvalidStateTransitionError, InvalidOperationError
├── events/                   # One file per event, all extend DomainEvent
├── time/                     # TimeProvider interface + SystemClock + FakeClock
└── value-objects/            # MemoryId, Importance (1–10), KnowledgeId
```

**State machine**

```
ACTIVE ──archive()──► ARCHIVED ──restore()──► ACTIVE
ACTIVE ──forget()───► FORGOTTEN  (terminal)
ACTIVE ──delete()───► DELETED    (terminal)
ARCHIVED ──delete()─► DELETED    (terminal)
```

`linkKnowledge()` is only permitted in `ACTIVE` state.

**Invariants on every mutation**

1. `_version++`
2. Push a domain event (with `schemaVersion: 1`, unique `eventId`, correct `aggregateVersion`)
3. `_updatedAt` ← `clock.now()`
4. No setters — state changes only via behavior methods

Failed transitions must throw `InvalidStateTransitionError` **before** mutating any field.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| `linkKnowledge()` idempotent (same value → no-op) | Prevents duplicate references without throwing on retries |
| `FORGOTTEN` and `DELETED` are terminal | No `restore()` path; prevents accidental resurrection |
| `_references` is `KnowledgeId[]` with `.equals()` dedup | JS `Set` uses reference equality — would silently allow duplicates |
| `TimeProvider` injected per-call | Keeps aggregate stateless w.r.t. time; `FakeClock` makes tests deterministic |
| `reconstitute()` is `static` | Avoids chicken-and-egg: you can't call an instance method before you have an instance |
| `pullEvents()` is destructive | Clears the queue; caller must handle events before discarding the reference |
| `toSnapshot()` returns `Object.freeze(...)` | Snapshot is an immutable DTO; prevents accidental mutation in the repository layer |

### Snapshot / Reconstitution Flow

```
MemoryRecord.toSnapshot()  ──►  MemorySnapshot  ──►  (repository adapter persists)
(repository adapter reads)  ──►  MemorySnapshot  ──►  MemoryRecord.reconstitute(snapshot)
```

`reconstitute()` emits **no events** — it rebuilds state silently.

## Testing Conventions

- Test file: `src/__tests__/domain/memory/memory-record.spec.ts`
- All tests use `FakeClock` — never `new Date()` or `Date.now()` in tests.
- Test only public API (`status`, `version`, `pullEvents()`, `references`, `toSnapshot()`). Never inspect private fields.
- The behavior matrix that must remain green before any Sprint 2.5 work:
  - State machine (valid + invalid transitions)
  - No side effects on failed transitions
  - Version increment on every mutation
  - Event queue (order, payload, uniqueness, schemaVersion)
  - `pullEvents()` clears queue
  - Deterministic timestamps via `FakeClock`
  - Metadata integrity (archive/restore don't touch content/importance/refs)
  - Idempotent `linkKnowledge()`
  - Snapshot round-trip (`toSnapshot` → `reconstitute` → resume transitions)

## Sprint Roadmap

| Sprint | Scope |
|---|---|
| **2.4** ✅ | Frozen `MemoryRecord` aggregate + 51 unit tests |
| **2.5** ✅ | `MemoryRepository` interface, `MemorySnapshot` mapper, Drizzle/SQLite adapter, repository contract tests (71 tests total) |
| **2.6** | Application layer: command handlers, use cases, transaction boundaries, event dispatch |
| **2.7** | Event bus, outbox pattern, async consumers |

### Sprint 2.5 — Repository Layer (done)

```
src/
├── domain/memory/
│   └── memory-repository.interface.ts      # Port: save/findById/delete
└── infrastructure/persistence/memory/
    ├── schema/memory-records.schema.ts      # Drizzle SQLite schema
    ├── mappers/memory.mapper.ts             # Snapshot ↔ DB row (ISO dates, JSON refs)
    ├── drizzle.memory-repository.ts         # Production adapter
    └── in-memory.memory-repository.ts      # Fast adapter for tests / dev
```

**Key schema note**: the `references` column is named `refs` in the DB (SQLite reserved word).

**Contract tests** (`src/__tests__/infrastructure/persistence/memory/memory-repository.contract.spec.ts`) run the same 10 assertions against both `InMemoryMemoryRepository` and `DrizzleMemoryRepository`.

### Sprint 2.6 — Application Layer (next)

Command handlers receive IDs, load the aggregate via the repository, call domain methods, persist, then publish pulled events:

```ts
// Pattern for every command handler
const memory = await repo.findById(id);          // load
memory.archive(clock);                           // domain method
await repo.save(memory);                         // persist
await eventBus.publish(memory.pullEvents());     // dispatch events AFTER save
```

Outbox sits BEFORE the event bus (same DB transaction as the write):
`save(memory)` → write snapshot + outbox rows atomically → outbox processor → event bus → consumers
