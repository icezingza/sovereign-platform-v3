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
npm run build                     # tsc -> dist/
npm start                         # node dist/main.js (runs the HTTP API; build first)
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
| **2.10** ✅ | Composition root: NestJS app wiring all 7 handlers behind REST endpoints, real SQLite backing, outbox polling driver running for real (118 tests total) |
| **2.11** ✅ | `Knowledge` aggregate (domain + persistence + application + HTTP), `UnitOfWork` extended to carry `knowledgeRepo`, `LinkKnowledgeHandler` now validates the linked knowledge actually exists (169 tests total) |
| **2.12** ✅ | List/search queries: `findAll()` on both repositories, `ListMemoriesHandler`/`ListKnowledgeHandler`, `GET /memories` and `GET /knowledge` with status filter + limit/offset pagination (197 tests total) |

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

### Sprint 2.10 — Composition Root / Runnable API (done)

```
src/
├── main.ts                                       # NestJS bootstrap; enableShutdownHooks()
├── app.module.ts                                  # Single root module: wires everything below
└── infrastructure/
    ├── composition/
    │   ├── tokens.ts                              # DI symbols for interfaces (no runtime value to use as a token)
    │   ├── persistence.providers.ts                # SQLITE_CONNECTION -> DRIZZLE_DB -> UnitOfWork/MemoryRepository/OutboxRepository/EventBus/OutboxProcessor/OutboxPollingDriver
    │   ├── handlers.providers.ts                   # The 7 existing handlers, constructed via useFactory against the above tokens
    │   └── outbox-lifecycle.service.ts              # OnApplicationBootstrap starts the polling driver; OnApplicationShutdown stops it + closes the sqlite connection
    └── http/
        ├── memory.controller.ts                    # REST endpoints, one per handler, no new business logic
        └── domain-error.filter.ts                   # ApplicationError/DomainError -> HTTP status (MemoryNotFoundError -> 404, else 409)
└── infrastructure/persistence/schema.ts             # ensureSchema(sqlite): CREATE TABLE IF NOT EXISTS for both tables
```

Sprints 2.4–2.9 built every layer (aggregate, repositories, command handlers, outbox, polling driver, query handler) but none of it had ever been wired together outside of test code — there was no `main.ts`, no HTTP entry point, and no migration/bootstrap step that created real tables against a real file. This sprint adds exactly one new thing: a composition root that constructs the existing pieces and exposes them over REST. **No new domain or application logic was added** — `MemoryController` methods are 1:1 pass-throughs to the existing handler `execute()` methods.

**Framework choice**: NestJS, per CLAUDE.md's own Layer Boundaries wording ("Domain knows nothing about ORM, HTTP, NestJS, or any framework") — the doc already named the intended outer-layer framework. Per that same boundary, NestJS touches only `src/main.ts`, `src/app.module.ts`, and `src/infrastructure/{composition,http}/` — no `@Injectable()`/`@Controller()` decorators or NestJS imports appear anywhere in `src/domain/` or `src/application/`.

**Why custom DI tokens instead of `@Injectable()` on the handlers**: the 6 command handlers and `GetMemoryByIdHandler` live in the application layer and must stay framework-free, so they're never decorated. Instead, `handlers.providers.ts` registers each handler class itself as its own NestJS provider token (`{ provide: CreateMemoryHandler, useFactory: (uow, clock) => new CreateMemoryHandler(uow, clock), inject: [...] }`) — Nest matches this against the controller's constructor parameter types without requiring the handler class to carry any Nest metadata. Lower-level interfaces (`UnitOfWork`, `MemoryRepository`, `TimeProvider`, etc.) have no runtime value to use as a token, so `tokens.ts` defines `Symbol()` tokens for those instead.

**No migration tooling exists yet** (Sprint 2.5/2.7 only ever created tables ad hoc inside test `setup()` functions) — `infrastructure/persistence/schema.ts` mirrors that exact DDL in one `ensureSchema()` call invoked once when the composition root opens its SQLite connection, rather than introducing a new migration system for a single call site.

**Config**: two environment variables, both optional — `DB_PATH` (default `./data/sovereign.sqlite`; `:memory:` is accepted for ephemeral/test runs) and `OUTBOX_POLL_INTERVAL_MS` (default `5000`). No `@nestjs/config` dependency was added since two `process.env` reads don't justify it.

**Error mapping**: `DomainErrorFilter` is the only new translation logic — it maps `MemoryNotFoundError` to 404 and any other `DomainError`/`ApplicationError` (e.g. `InvalidStateTransitionError` from an invalid state machine transition) to 409. Plain `Error`s thrown by value-object factories (`Importance.create`, `MemoryId.create`) are deliberately left unmapped and fall through to Nest's default 500 handler — they're pre-existing domain-layer behavior (Sprint 2.4 is frozen) and mapping them would mean guessing at semantics the domain layer doesn't currently express.

**Tests**: `composition-root.e2e.spec.ts` boots the real `AppModule` via `@nestjs/testing` + `supertest` against an in-memory SQLite connection (`DB_PATH=':memory:'`, set in `jest.setup.js` so it's resolved before the providers module is imported) and drives the actual HTTP layer — create → get → archive (asserts version increments and status changes through real persistence), a 404 case, and a 409 case (archiving a deleted memory). This is in addition to manual verification: built with `npm run build`, ran `node dist/main.js` against a real on-disk SQLite file, and curled the full lifecycle (create/get/archive/restore/link-knowledge/forget/invalid-transition/not-found) — confirmed the outbox polling driver actually drains and marks events processed against the real file, not just in the mocked test path.

### Sprint 2.11 — Knowledge Aggregate (done)

```
src/
├── domain/knowledge/
│   ├── knowledge.ts                                  # Aggregate Root — ACTIVE ↔ ARCHIVED only
│   ├── knowledge-snapshot.ts                         # DTO boundary for persistence
│   ├── knowledge-status.ts                           # Enum: ACTIVE | ARCHIVED
│   ├── knowledge-repository.interface.ts             # Port: save/findById/delete
│   └── events/                                        # KnowledgeCreated/Archived/Restored, all extend DomainEvent
├── infrastructure/persistence/knowledge/
│   ├── schema/knowledge-entries.schema.ts            # Drizzle SQLite schema
│   ├── mappers/knowledge.mapper.ts                   # Snapshot ↔ DB row
│   ├── drizzle.knowledge-repository.ts               # Production adapter
│   └── in-memory.knowledge-repository.ts             # Fast adapter for tests / dev
└── application/knowledge/
    ├── errors/application-error.ts                    # KnowledgeNotFoundError
    ├── commands/{create,archive,restore}-knowledge.handler.ts
    └── queries/get-knowledge-by-id.handler.ts
```

Sprint 2.6's `linkKnowledge()` accepted any string ID with nothing to validate against — `MemoryRecord.references` was a list of IDs pointing at an aggregate that didn't exist yet. This sprint adds that aggregate: `Knowledge` is `MemoryRecord`'s structural sibling (same private-constructor + `static create()`/`static reconstitute()` + behavior-methods-only shape) but with a deliberately smaller 2-state machine (`ACTIVE ↔ ARCHIVED`, no `FORGOTTEN`/`DELETED`) since nothing in the codebase calls for richer Knowledge lifecycle semantics yet.

**Shared-kernel reuse**: `Knowledge` imports `DomainEvent`, `TimeProvider`/`FakeClock`, `DomainError`/`InvalidStateTransitionError`/`InvalidOperationError`, and `KnowledgeId` directly from their existing locations under `domain/memory/` rather than duplicating them — those pieces were already aggregate-agnostic. `EventSerializer.toOutboxEvents()` (Sprint 2.7) and the `OutboxRepository`/`OutboxEvent` envelope are likewise reused unmodified — `OutboxEvent.aggregateId` was always a plain `string`, so Knowledge events flow through the exact same outbox pipeline as Memory events with zero infrastructure changes.

**`UnitOfWorkContext` extended**: `{ repo, outbox }` became `{ repo, knowledgeRepo, outbox }`. `DrizzleUnitOfWork.execute()` already constructed its repositories fresh per call from the shared `db`, so adding `DrizzleKnowledgeRepository` there was one line and shares the same `BEGIN`/`COMMIT`/`ROLLBACK` wrapper for free. `InMemoryUnitOfWork` took `repo`/`outbox` via constructor, so it gained a third `knowledgeRepo` constructor parameter — its two existing call sites in `command-handlers.spec.ts` were updated accordingly.

**`LinkKnowledgeHandler` tightened**: it now calls `knowledgeRepo.findById(knowledgeId)` inside the same `UnitOfWork.execute()` transaction and throws `KnowledgeNotFoundError` before calling `memory.linkKnowledge(...)` if the knowledge doesn't exist — closing the gap that motivated this sprint. `DomainErrorFilter` maps `KnowledgeNotFoundError` to 404 alongside `MemoryNotFoundError`.

**HTTP**: `KnowledgeController` at `/knowledge` (`POST /`, `GET /:id`, `POST /:id/archive`, `POST /:id/restore`) is a 1:1 pass-through to the four new handlers, mirroring `MemoryController`'s shape exactly. No `DELETE` endpoint — `Knowledge` has no terminal/deleted state.

**Tests**: `knowledge.spec.ts` (domain, 19 tests) mirrors `memory-record.spec.ts`'s structure scaled to the 2-state machine. `knowledge-repository.contract.spec.ts` mirrors the Sprint 2.5 `describe.each` contract-test pattern over `InMemoryKnowledgeRepository` + `DrizzleKnowledgeRepository`. `application/knowledge/command-handlers.spec.ts` and `get-knowledge-by-id.handler.spec.ts` cover the four application handlers. `command-handlers.spec.ts` (Memory) gained a `seedActiveKnowledge` helper and a new test asserting `LinkKnowledgeHandler` throws `KnowledgeNotFoundError` (with no outbox append) when the referenced knowledge doesn't exist. `composition-root.e2e.spec.ts` gained a full Knowledge HTTP lifecycle test (create → get → archive → restore, asserting version increments through real persistence), a 404 case, a positive link-knowledge happy path now that validation exists, and a 404 case for linking a non-existent knowledge id. Manual verification: built with `npm run build`, ran `node dist/main.js` against a real on-disk SQLite file, curled the full Knowledge lifecycle plus a real Memory↔Knowledge link, and confirmed via direct SQLite inspection that all five `KnowledgeCreated`/`KnowledgeArchived`/`KnowledgeRestored`/`MemoryCreated`/`KnowledgeLinked` outbox events were drained and marked processed by the real polling driver.

### Sprint 2.12 — List/Search Queries (done)

```
src/
├── domain/{memory,knowledge}/
│   └── {memory,knowledge}-repository.interface.ts    # gained findAll(options?), ListMemoriesOptions/ListKnowledgeOptions
├── infrastructure/persistence/{memory,knowledge}/
│   ├── drizzle.{memory,knowledge}-repository.ts       # findAll(): optional status eq(), orderBy(desc(createdAt)), limit/offset
│   └── in-memory.{memory,knowledge}-repository.ts     # findAll(): filter + sort + slice over the in-memory Map
├── application/{memory,knowledge}/queries/
│   └── list-{memories,knowledge}.handler.ts           # ListMemoriesHandler / ListKnowledgeHandler
└── infrastructure/http/
    ├── list-query.util.ts                              # parseListQuery(): shared status/limit/offset validation
    ├── memory.controller.ts                             # gained GET /memories
    └── knowledge.controller.ts                          # gained GET /knowledge
```

Sprints 2.9 and 2.11 both explicitly deferred a list/`findAll()` capability as out of scope — by this sprint that gap was the single biggest hole in the API surface: memories and knowledge could be created and fetched by id, but never enumerated. `ListMemoriesOptions`/`ListKnowledgeOptions` (`{ status?, limit?, offset? }`) were added to the existing repository interfaces rather than introducing a separate read-model/query-repository port, since both adapters already had everything needed (the full `Map`/table) to implement pagination directly.

**Ordering and defaults**: `findAll()` always orders by `createdAt` descending (most-recent-first) and defaults to `limit: 50, offset: 0` when omitted, applied identically in both the Drizzle adapter (`.orderBy(desc(...)).limit(...).offset(...)`) and the in-memory adapter (`.sort(...).slice(...)`). The Drizzle adapter's `.where(status ? eq(...) : undefined)` relies on confirmed `drizzle-orm` behavior — passing `undefined` to `.where()` is valid and returns the unfiltered query — avoiding a branched query-builder chain.

**Query handlers stay outside `UnitOfWork`**, consistent with `GetMemoryByIdHandler` (Sprint 2.9): a list read needs no transaction or outbox append, so `ListMemoriesHandler`/`ListKnowledgeHandler` take the repository directly and map results through `toSnapshot()`.

**HTTP validation**: `parseListQuery()` is a small shared utility (status must be one of the enum's values, `limit` an integer in `[1, 100]`, `offset` a non-negative integer) used identically by both `MemoryController.list()` and `KnowledgeController.list()` — justified as a real, byte-for-byte duplication between two concrete call sites rather than a speculative abstraction. Invalid query params throw `BadRequestException` (400) before reaching the handler.

**Tests**: `memory-repository.contract.spec.ts` and `knowledge-repository.contract.spec.ts` each gained a `findAll()` describe block (empty result, descending order via `FakeClock.tick()`, status filter, limit/offset pagination) run against both adapters. `list-memories.handler.spec.ts` and `list-knowledge.handler.spec.ts` (new files) cover the application handlers directly against `InMemoryMemoryRepository`/`InMemoryKnowledgeRepository`. `composition-root.e2e.spec.ts` gained list/filter/paginate/400-validation cases for both `GET /memories` and `GET /knowledge` against the real wired app. 197 tests total.
