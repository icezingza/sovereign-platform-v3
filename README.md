# Sovereign Platform v3

**Professional AI Memory & Cognition Engine** built with Domain-Driven Design in TypeScript.

A clean, testable, and production-ready foundation for building intelligent agents with persistent long-term memory.

## ✨ Features

- Domain-Driven Design (DDD) architecture
- Rich MemoryRecord aggregate with full lifecycle management
- Event Sourcing friendly (Snapshot & Reconstitute pattern)
- Deterministic testing with FakeClock
- Clean separation between Domain, Application, and Infrastructure layers
- SQLite persistence adapter included
- Full TypeScript support with strict type checking

## Quick Start

```bash
git clone https://github.com/icezingza/sovereign-platform-v3.git
cd sovereign-platform-v3
npm install
npm run typecheck
npm test
```

## Project Structure

```
src/
├── domain/           # Core business logic
├── application/      # Use cases
├── infrastructure/   # Database & external adapters
└── __tests__/        # Comprehensive test suite
```

## Core Concepts

- **MemoryRecord** — The heart of the system
- **MemoryStatus** — Active, Archived, Forgotten, Deleted
- **Domain Events** — Track every state change
- **Repository Pattern** — Clean persistence layer

## Roadmap

- Publish as npm package
- Create example AI agent projects
- Add vector search integration
- Build documentation website

## License

MIT © Icezingza

---

Built for Sovereign AI Systems
