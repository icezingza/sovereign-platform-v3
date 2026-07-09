# NamoNexus Sovereign Platform v3

[![CI](https://github.com/icezingza/sovereign-platform-v3/actions/workflows/ci.yml/badge.svg)](https://github.com/icezingza/sovereign-platform-v3/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sovereign-platform-v3)](https://www.npmjs.com/package/sovereign-platform-v3)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](./tsconfig.json)

**Professional AI Memory & Cognition Engine** built with TypeScript + Domain-Driven Design.

A clean, testable, production-ready foundation for building intelligent agents with persistent long-term memory: a rich `MemoryRecord` aggregate with a strict lifecycle state machine, a `Knowledge` aggregate with validated linking, a transactional outbox for reliable event delivery, and a ready-to-run REST API — backed by **209 tests**.

## ✨ Features

- **Rich `MemoryRecord` aggregate** — full lifecycle state machine (`ACTIVE → ARCHIVED → FORGOTTEN/DELETED`), versioning on every mutation, no setters
- **`Knowledge` aggregate with validated linking** — memories can only reference knowledge that actually exists
- **Domain events + Transactional Outbox** — every state change emits an event; `UnitOfWork` writes the aggregate and the outbox atomically, a polling driver delivers them to consumers
- **Strict Clean Architecture** — the domain layer has zero framework dependencies; swap adapters freely
- **Two persistence adapters per port** — in-memory (zero-setup dev/tests) and Drizzle + SQLite (production), verified by shared contract tests
- **List & content search** — status filter, case-insensitive substring search, pagination
- **Deterministic testing** — injectable `TimeProvider` with `FakeClock`; no `Date.now()` anywhere in tests
- **Ready-to-run REST API** — NestJS composition root wiring everything behind HTTP endpoints

## 🚀 Quick Start

### As a library

```bash
npm install sovereign-platform-v3
```

```ts
import { MemoryRecord, MemoryId, Importance, SystemClock } from 'sovereign-platform-v3';
import { randomUUID } from 'crypto';

const clock = new SystemClock();
const memory = MemoryRecord.create(
  MemoryId.create(randomUUID()),
  'User prefers dark blue theme with neon cyan accents',
  Importance.create(9),
  clock,
);

memory.archive(clock);          // state machine enforced — invalid moves throw
console.log(memory.status);     // ARCHIVED
console.log(memory.version);    // 2 — incremented on every mutation
console.log(memory.pullEvents().map((e) => e.constructor.name));
// ['MemoryCreatedEvent', 'MemoryArchivedEvent']
```

See [`examples/`](./examples) for three runnable examples: the pure domain model, a full agent integration with the application layer and outbox, and real SQLite persistence.

### As a REST API

```bash
git clone https://github.com/icezingza/sovereign-platform-v3.git
cd sovereign-platform-v3
npm install
npm run build
npm start        # http://localhost:3000, SQLite at ./data/sovereign.sqlite
```

```bash
curl -X POST localhost:3000/memories \
  -H 'Content-Type: application/json' \
  -d '{"content": "First meeting with the AI team", "importance": 8}'
```

Configuration (both optional): `DB_PATH` (default `./data/sovereign.sqlite`, accepts `:memory:`) and `OUTBOX_POLL_INTERVAL_MS` (default `5000`).

## 🌐 REST API

| Method | Path | Description |
|---|---|---|
| `POST` | `/memories` | Create a memory (`{ content, importance: 1–10 }`) |
| `GET` | `/memories` | List memories — `?status=`, `?search=`, `?limit=`, `?offset=` |
| `GET` | `/memories/:id` | Get a memory by id |
| `POST` | `/memories/:id/archive` | Archive an active memory |
| `POST` | `/memories/:id/restore` | Restore an archived memory |
| `POST` | `/memories/:id/forget` | Forget a memory (terminal) |
| `POST` | `/memories/:id/link-knowledge` | Link existing knowledge (`{ knowledgeId }`) |
| `DELETE` | `/memories/:id` | Delete a memory (terminal) |
| `POST` | `/knowledge` | Create a knowledge entry (`{ content }`) |
| `GET` | `/knowledge` | List knowledge — same query params as `/memories` |
| `GET` | `/knowledge/:id` | Get a knowledge entry by id |
| `POST` | `/knowledge/:id/archive` | Archive a knowledge entry |
| `POST` | `/knowledge/:id/restore` | Restore an archived knowledge entry |

Errors map cleanly: `404` for unknown ids, `409` for invalid state transitions, `400` for invalid query parameters.

## 🏛 Architecture

```
Domain  ←  Application  ←  Infrastructure
  ↑
nothing (domain has zero outward dependencies)
```

- **Domain** (`src/domain/`) — aggregates, value objects, domain events, repository ports. No framework, no ORM, no HTTP.
- **Application** (`src/application/`) — command/query handlers that orchestrate only. Every mutation runs inside a `UnitOfWork` that saves the aggregate snapshot and appends its events to the outbox in one transaction.
- **Infrastructure** (`src/infrastructure/`) — Drizzle/SQLite and in-memory adapters, the event bus, and the NestJS composition root + HTTP controllers.

### Memory lifecycle

```
ACTIVE ──archive()──► ARCHIVED ──restore()──► ACTIVE
ACTIVE ──forget()───► FORGOTTEN  (terminal)
ACTIVE ──delete()───► DELETED    (terminal)
ARCHIVED ──delete()─► DELETED    (terminal)
```

Every mutation increments the aggregate version, timestamps via the injected clock, and queues a domain event. Failed transitions throw `InvalidStateTransitionError` **before** mutating any field.

### Reliable events (Transactional Outbox)

```
handler ──UnitOfWork──► [ aggregate save + outbox append ]  (atomic)
OutboxPollingDriver ──► OutboxProcessor ──► EventBus ──► your EventConsumers
```

Register an `EventConsumer` for an `eventType` on the `DispatchingEventBus` and it receives every matching event exactly as persisted — even if the process crashed between the write and the dispatch.

## 🧪 Development

```bash
npm test                          # run all 209 tests
npm run test:watch                # watch mode
npm run test:single -- <pattern>  # one file, e.g. memory-record
npm run test:coverage             # coverage report
npm run typecheck                 # type-check without emitting
npm run build                     # compile to dist/
```

Tests include the domain behavior matrix, repository **contract tests** run against both the in-memory and SQLite adapters, transaction rollback verification, outbox processing, and end-to-end HTTP tests booting the real composition root.

## 📦 Project Structure

```
src/
├── index.ts                  # public API (library entry point)
├── domain/
│   ├── memory/               # MemoryRecord aggregate, value objects, events, ports
│   └── knowledge/            # Knowledge aggregate, events, port
├── application/
│   ├── memory/               # 6 command handlers + 2 query handlers
│   ├── knowledge/            # 3 command handlers + 2 query handlers
│   ├── ports/                # UnitOfWork, EventBus, OutboxRepository, ...
│   └── services/             # OutboxProcessor, OutboxPollingDriver
├── infrastructure/
│   ├── persistence/          # Drizzle + in-memory adapters, UnitOfWork impls
│   ├── events/               # DispatchingEventBus, InMemoryEventBus
│   ├── http/                 # REST controllers + error filter
│   └── composition/          # NestJS DI wiring
└── main.ts                   # REST API entry point
```

## 📄 License

MIT © [icezingza](https://github.com/icezingza) — NamoNexus

Built to elevate existence.
