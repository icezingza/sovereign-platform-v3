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
| **2.6** ✅ | Application layer: command handlers, `EventBus` port, `InMemoryEventBus` adapter (84 tests total) |
| **2.7** ✅ | Outbox pattern, `UnitOfWork` port, `OutboxProcessor`, `DispatchingEventBus` async consumers (105 tests total) |
| **2.8** ✅ | `OutboxPollingDriver` — interval-based scheduler for `OutboxProcessor.processPending()` (112 tests total) |
| **2.9** ✅ | Query side: `GetMemoryByIdHandler` (115 tests total) |

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

### Sprint 2.6 — Application Layer (done)

```
src/
├── application/
│   ├── ports/
│   │   └── event-bus.interface.ts            # Port: publish(events)
│   └── memory/
│       ├── errors/application-error.ts        # ApplicationError, MemoryNotFoundError
│       └── commands/
│           ├── create-memory.handler.ts
│           ├── archive-memory.handler.ts
│           ├── restore-memory.handler.ts
│           ├── forget-memory.handler.ts
│           ├── delete-memory.handler.ts
│           └── link-knowledge.handler.ts
└── infrastructure/events/
    └── in-memory.event-bus.ts                # Fast adapter for tests / dev
```

Command handlers receive IDs, load the aggregate via the repository, call domain methods, persist, then publish pulled events. **Superseded in Sprint 2.7** — see below: the direct `repo` + `eventBus` constructor params and the `eventBus.publish()` call were replaced by a `UnitOfWork` that atomically saves the aggregate and appends to the outbox.

Each of the five mutating handlers (archive/restore/forget/delete/linkKnowledge) is deliberately written out rather than factored into a shared base class — explicit duplication over premature abstraction for five short, simple flows. `CreateMemoryHandler` is the only handler that doesn't load first; it generates a new `MemoryId` and calls `MemoryRecord.create()`.

### Sprint 2.7 — Outbox Pattern (done)

```
src/
├── application/
│   ├── ports/
│   │   ├── event-bus.interface.ts            # Port: publish(events: OutboxEvent[])
│   │   ├── event-consumer.interface.ts       # Port: { eventType, handle(event) }
│   │   ├── outbox-event.ts                   # OutboxEvent DTO (generic envelope)
│   │   ├── outbox-repository.interface.ts    # Port: append/findUnprocessed/markProcessed
│   │   └── unit-of-work.interface.ts         # Port: execute(work) -> { repo, outbox }
│   ├── memory/
│   │   ├── mappers/event-serializer.ts       # DomainEvent -> OutboxEvent
│   │   └── commands/*.handler.ts             # rewritten to take (unitOfWork, clock)
│   └── services/
│       └── outbox-processor.ts               # findUnprocessed -> publish -> markProcessed
└── infrastructure/
    ├── events/
    │   ├── in-memory.event-bus.ts            # rewritten for OutboxEvent[]
    │   └── dispatching.event-bus.ts          # routes OutboxEvent -> registered EventConsumers by eventType
    └── persistence/
        ├── in-memory.unit-of-work.ts         # no-op wrapper (no real atomicity needed for Map-backed adapters)
        ├── drizzle.unit-of-work.ts           # manual BEGIN/COMMIT/ROLLBACK around an async callback
        └── outbox/
            ├── schema/outbox-events.schema.ts
            ├── mappers/outbox.mapper.ts
            ├── drizzle.outbox-repository.ts
            └── in-memory.outbox-repository.ts
```

Once an event crosses the outbox boundary it's serialized into the generic `OutboxEvent` envelope (`eventId`, `aggregateId`, `eventType: string`, `occurredAt`, `schemaVersion`, `payload: Record<string, unknown>`) — consumers downstream key off `eventType` strings, not `instanceof` checks against concrete `DomainEvent` subclasses.

Every mutating command handler now runs inside a single `UnitOfWork.execute()` call so the snapshot write and the outbox append are atomic:

```ts
// Pattern for every command handler
await this.unitOfWork.execute(async ({ repo, outbox }) => {
  const memory = await repo.findById(id);
  if (!memory) throw new MemoryNotFoundError(id);
  memory.archive(this.clock);
  await repo.save(memory);
  await outbox.append(EventSerializer.toOutboxEvents(memory.pullEvents()));
});
```

**`DrizzleUnitOfWork` note**: better-sqlite3's native `db.transaction()` only accepts a *synchronous* callback, which doesn't fit handlers that `await findById()` before deciding what to write next (the await yields to the microtask queue, so the sync wrapper would COMMIT before the callback's later statements ran). Since better-sqlite3 is a single, synchronous connection anyway, `DrizzleUnitOfWork` issues `BEGIN`/`COMMIT`/`ROLLBACK` manually via `db.$client` around an awaited async callback instead — same atomicity guarantee, compatible with async/await. `InMemoryUnitOfWork` needs no such ceremony; it just invokes the callback directly against the shared in-memory adapters.

`OutboxProcessor.processPending(limit = 50)` reads unprocessed rows, publishes them to the `EventBus`, then marks them processed — this is the only thing that calls `eventBus.publish()` now; command handlers never call it directly. `DispatchingEventBus` is the production-shaped `EventBus`: `register(consumer)` to subscribe an `EventConsumer` to a given `eventType`, then `publish()` fans each event out to its registered consumers.

**Tests**:
- `command-handlers.spec.ts` (13 tests) — rewritten to assert against the outbox (`outbox.findUnprocessed()`) instead of an injected `EventBus`; the transaction-boundary test now asserts `outbox.append()` is never called when `repo.save()` throws.
- `outbox-repository.contract.spec.ts` — `describe.each` over `InMemoryOutboxRepository` + `DrizzleOutboxRepository`, mirroring the Sprint 2.5 repository contract test style: append/findUnprocessed/markProcessed round-trip, ordering by `occurredAt`, limit, idempotent `markProcessed`, empty-array no-op.
- `drizzle.unit-of-work.spec.ts` — verifies the manual transaction wrapper actually commits both tables together on success and rolls back both on a thrown error, plus that reads via `repo.findById()` see prior writes within the same unit of work.
- `outbox-processor.spec.ts` — `processPending()` behavior (publish + mark processed, no-op when empty, no reprocessing, `limit`), and `DispatchingEventBus` routing events to the correct `EventConsumer` by `eventType`.

Not yet implemented (closed out in Sprint 2.8 below): a scheduled/polling driver that calls `OutboxProcessor.processPending()` on an interval. Still not implemented, and deliberately deferred: real `EventConsumer` implementations (only `RecordingConsumer` exists, in tests) — no concrete downstream consumer use case exists in the project yet.

### Sprint 2.8 — Outbox Polling Driver (done)

```
src/
├── application/services/
│   └── outbox-polling-driver.ts                # OutboxPollingDriver: start()/stop() around OutboxProcessor.processPending()
└── __tests__/application/services/
    └── outbox-polling-driver.spec.ts            # jest.useFakeTimers() based scheduling tests
```

`OutboxPollingDriver` wraps an `OutboxProcessor` with `start()`/`stop()` and runs `processPending()` on a recursive `setTimeout` loop — the next tick is only scheduled after the current call settles (success or failure), so a single driver instance never has two overlapping `processPending()` calls in flight. This is a single-process mitigation of the "race condition in concurrent outbox processing" concern raised in the Sprint 2.7 PR review; true multi-process/distributed locking (e.g. `SELECT ... FOR UPDATE SKIP LOCKED`, not supported by SQLite) remains out of scope since nothing in this project runs multiple worker processes yet.

Errors thrown by `processPending()` are caught per-tick and routed to an optional `onError` callback (default no-op) so a transient failure doesn't kill the polling loop. `start()` is idempotent (calling it while already running is a no-op); `stop()` clears the pending timer.

### Sprint 2.9 — Query Side (done)

```
src/
├── application/memory/queries/
│   └── get-memory-by-id.handler.ts             # GetMemoryByIdHandler: MemoryRepository -> MemorySnapshot | null
└── __tests__/application/memory/queries/
    └── get-memory-by-id.handler.spec.ts
```

Sprints 2.6–2.8 built out a complete write side (6 command handlers) but no query/read counterpart — the only existing reads (`repository.findById`) were internal to command handlers loading an aggregate before mutating it. `GetMemoryByIdHandler` closes that gap with a single, minimal query mirroring the existing command pattern (a `{ id: string }` query DTO, an `execute()` method), but deliberately does **not** go through `UnitOfWork` — a single read needs no transaction or outbox append, so it takes a `MemoryRepository` directly. It returns `MemorySnapshot | null` rather than the `MemoryRecord` aggregate, consistent with the project's snapshot-as-DTO-boundary convention (`toSnapshot()` returns a frozen DTO; handing out the live aggregate to a read consumer would leak mutation capability across the application boundary).

No `ListMemories`/`findAll` query was added — `MemoryRepository` only exposes `findById`, and adding a list capability would require a new repository method plus both adapter implementations, which is out of scope until a concrete use case needs it.

Real `EventConsumer` implementations remain deliberately out of scope (see note above).
