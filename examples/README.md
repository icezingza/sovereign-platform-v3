# Examples

Runnable, self-contained examples of the three main ways to use the platform.
All of them import from `../src` so they run straight from a clone — after
`npm publish`, replace that import with `sovereign-platform-v3`.

```bash
npm install                              # once, from the repository root
npx tsx examples/basic-usage.ts
npx tsx examples/agent-integration.ts
npx tsx examples/sqlite-persistence.ts
```

| Example | What it shows |
|---|---|
| [`basic-usage.ts`](./basic-usage.ts) | The `MemoryRecord` aggregate on its own: create, link knowledge (idempotent), the full state machine, domain events via `pullEvents()`, snapshot round-trip, and how invalid transitions are rejected. No persistence. |
| [`agent-integration.ts`](./agent-integration.ts) | An AI agent using the application layer end-to-end: command/query handlers, `UnitOfWork`, knowledge linking with existence validation, list/search queries, and the transactional outbox delivering events to a registered consumer. Uses the in-memory adapters (zero setup). |
| [`sqlite-persistence.ts`](./sqlite-persistence.ts) | The production adapters: better-sqlite3 + Drizzle, `ensureSchema()` bootstrap, real transactions via `DrizzleUnitOfWork`, and `OutboxPollingDriver` draining events in the background. |

There is also a fourth way to run the platform — as a standalone REST API:

```bash
npm run build && npm start        # NestJS app on :3000, SQLite-backed
curl -X POST localhost:3000/memories \
  -H 'Content-Type: application/json' \
  -d '{"content": "hello", "importance": 5}'
```

See the [main README](../README.md#rest-api) for the full endpoint list.
