# NamoNexus Sovereign Platform

**Elevate your existence with NamoNexus.**

Professional AI Memory & Cognition Engine — Engineered for excellence.

A production-grade TypeScript library that delivers reliable, structured, and persistent long-term memory for intelligent agents and sophisticated applications.

Built with strict Domain-Driven Design and Clean Architecture, NamoNexus gives developers a solid, trustworthy foundation they can build upon with confidence.

### Why NamoNexus

- **Strict Domain Model** — MemoryRecord and Knowledge aggregates with enforced business rules and lifecycle
- **Transactional Outbox** — Guaranteed event delivery with atomic consistency
- **Clean Architecture** — Domain layer completely independent from frameworks and infrastructure
- **Production Ready** — Dual persistence adapters with comprehensive test coverage
- **Enterprise Grade** — 209 tests, strict TypeScript, and battle-tested patterns

### Quick Start

**As a Library**

```bash
npm install sovereign-platform-v3
```

```typescript
import { MemoryRecord, MemoryId, Importance, SystemClock } from 'sovereign-platform-v3';

const memory = MemoryRecord.create(
  MemoryId.create(crypto.randomUUID()),
  "User prefers dark theme with neon cyan accents",
  Importance.create(9),
  new SystemClock()
);

memory.archive();
console.log(memory.getStatus()); // ARCHIVED
```

**As a REST API**

```bash
git clone https://github.com/icezingza/sovereign-platform-v3.git
cd sovereign-platform-v3
npm install
npm run dev
```

### Core Capabilities

- Rich aggregate lifecycle with strict state transitions
- Versioned snapshots and domain events on every mutation
- Transactional Outbox Pattern for reliable event processing
- Dual persistence (In-memory + Drizzle + SQLite)
- Full test coverage with contract and behavior testing

---

**Maintained by** Mr. Kanin Raksaraj  
**Contact:** contect@namonexus.com

Built to elevate existence.
