# NamoNexus Sovereign Platform

**Elevate your existence with NamoNexus.**

Professional AI Memory & Cognition Engine built with TypeScript, Domain-Driven Design, and strict transactional guarantees. (https://img.shields.io/npm/v/sovereign-platform-v3?style=for-the-badge)](https://www.npmjs.com/package/sovereign-platform-v3) (https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT) (https://img.shields.io/badge/Tests-209_passing-22c55e?style=for-the-badge)](https://github.com/icezingza/sovereign-platform-v3/actions) (https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org) (https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)

A clean, testable, and production-ready foundation for building intelligent agents with persistent long-term memory.

### ✨ Core Features

- **Strict MemoryRecord Aggregate** — Full lifecycle state machine (`ACTIVE → ARCHIVED → FORGOTTEN → DELETED`)
- **Transactional Outbox Pattern** — Reliable event delivery with atomic consistency
- **Knowledge Management** — Validated linking between memories and knowledge
- **Clean Architecture** — Domain layer completely independent from frameworks
- **Dual Persistence** — In-memory for tests and Drizzle + SQLite for production
- **209 Comprehensive Tests** — Covering domain rules, contracts, and end-to-end flows
- **Ready-to-use REST API** — Optional NestJS layer included

### 🚀 Quick Start

**As a Library**

```bash
npm install sovereign-platform-v3
```

```ts
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

---

**ดูตัวอย่างการใช้งานเพิ่มเติมได้ที่ (examples/)**

### 📄 Documentation
- (examples/)
- (docs/ARCHITECTURE.md)
- (docs/API.md)
- (CHANGELOG.md)

---

**Maintained by:** Mr. Kanin Raksaraj  
**Contact:** contect@namonexus.com

Built to elevate existence.
