# NamoNexus — Professional AI Memory & Cognition Engine

<div align="center">

**Elevate your existence with NamoNexus.**

</div>

NamoNexus is a production-ready AI memory and cognition foundation built with TypeScript, Domain-Driven Design, and robust transactional guarantees. Designed for engineers and product teams who want a clean, testable, and reliable persistent long-term memory layer for intelligent agents and applications.

Badges: [License: MIT](./LICENSE) • [CI](https://github.com/icezingza/sovereign-platform-v3/actions) • TypeScript (strict) • Node >= 18

## Why NamoNexus

- Product-grade long-term memory engine tailored for AI agents and context-aware systems
- Clear domain model (Memory, Knowledge) with strict lifecycle and invariants
- Transactional Outbox for exactly-once event delivery semantics
- Two persistence adapters: in-memory for tests and SQLite (Drizzle) for production
- Small, focused codebase with thorough tests and contract verification

## Key highlights

- Memory lifecycle enforced by the aggregate: ACTIVE → ARCHIVED → FORGOTTEN / DELETED
- Every change yields versioned snapshots + domain events
- Outbox pattern ensures atomic persistence of state + events
- Clean Architecture: domain layer has zero framework dependencies
- Deterministic tests with injectable clock; contract tests for adapters

## Quick start — Run locally

Clone and run the NamoNexus demo REST API (recommended for evaluation):

```bash
git clone https://github.com/icezingza/sovereign-platform-v3.git
cd sovereign-platform-v3
npm install
npm run build
npm start  # API on http://localhost:3000
```

Example POST to create a memory:

```bash
curl -X POST http://localhost:3000/memories \
  -H 'Content-Type: application/json' \
  -d '{"content": "First meeting with the AI team", "importance": 8}'
```

Configuration (optional):
- DB_PATH (default: ./data/sovereign.sqlite, accepts :memory:)
- OUTBOX_POLL_INTERVAL_MS (default: 5000)

## Quick start — Use as a library (developer preview)

Note: the package name and import path may vary; this shows the intended API surface.

```ts
import { MemoryRecord, MemoryId, Importance, SystemClock } from 'namonexus'; // package name TBD
import { randomUUID } from 'crypto';

const clock = new SystemClock();
const memory = MemoryRecord.create(
  MemoryId.create(randomUUID()),
  'User prefers a dark theme with neon cyan accents',
  Importance.create(9),
  clock,
);

memory.archive(clock);
console.log(memory.status); // ARCHIVED
```

For repository examples and runnable demos, see the `examples/` directory.

## REST API (overview)

- POST   /memories                 — create a memory ({ content, importance: 1–10 })
- GET    /memories                 — list memories (filters: status, search, limit, offset)
- GET    /memories/:id             — fetch a single memory
- POST   /memories/:id/archive     — archive an active memory
- POST   /memories/:id/restore     — restore an archived memory
- POST   /memories/:id/forget      — terminally forget a memory
- DELETE /memories/:id             — delete a memory (terminal)
- POST   /knowledge                — create knowledge ({ content })
- GET    /knowledge                — list knowledge

Errors: 404 for unknown ids, 409 for invalid state transitions, 400 for bad input.

## Architecture (brief)

Domain  ←  Application  ←  Infrastructure

- Domain: aggregates, value objects, domain events, and repository ports (zero framework deps)
- Application: command/query handlers, UnitOfWork, and business orchestration
- Infrastructure: persistence adapters (in-memory & Drizzle/SQLite), event dispatching, HTTP controllers

### Memory lifecycle

ACTIVE ──archive()──► ARCHIVED ──restore()──► ACTIVE
ACTIVE ──forget()───► FORGOTTEN  (terminal)
ACTIVE ──delete()───► DELETED    (terminal)
ARCHIVED ──delete()─► DELETED    (terminal)

All mutations increment aggregate version, timestamp via injected clock, and queue domain events.

## Development

Run tests and linters locally:

```bash
npm test                      # run test suite
npm run test:watch            # watch mode
npm run typecheck             # TS type-check
npm run build                 # compile to dist/
```

The test suite includes domain behavior matrices, contract tests for persistence adapters, outbox processing, and end-to-end flows.

## Examples

See `examples/` for runnable demos:
- basic-usage.ts — domain model usage
- agent-integration.ts — application layer + agent example
- sqlite-persistence.ts — Drizzle + SQLite persistence demo

## Maintainers & Contact

Maintained by Kanin Raksaraj — NamoNexus
Contact: contect@namonexus.com

## License

MIT © Kanin Raksaraj — NamoNexus

Built to elevate existence.
