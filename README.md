# Sovereign Platform v3

**Professional AI Memory & Cognition Engine** built with TypeScript + Domain-Driven Design.

A clean, testable, production-ready foundation for building intelligent agents with persistent long-term memory.

## ✨ Features

- Rich `MemoryRecord` aggregate with full lifecycle management
- Clean Domain-Driven Design architecture
- Snapshot & Reconstitute pattern (Event Sourcing compatible)
- Deterministic testing with FakeClock
- SQLite persistence adapter included
- Comprehensive test suite with high domain coverage
- Zero framework dependencies in the domain layer

## Quick Start

```bash
git clone https://github.com/icezingza/sovereign-platform-v3.git
cd sovereign-platform-v3
npm install
npm run typecheck
npm test
```

## Core Concepts

- **MemoryRecord** — Central entity representing knowledge and experiences
- **MemoryStatus** — Active, Archived, Forgotten, Deleted with strict transition rules
- **Domain Events** — Track every state change
- **Repository Pattern** — Clean persistence abstraction

## License

MIT © Icezingza

Built for Sovereign AI Systems.
