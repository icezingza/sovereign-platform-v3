# NaMo Sovereign Platform v3

**Advanced AI Memory & Cognition System** built with Domain-Driven Design (DDD) in TypeScript.

A robust, testable foundation for building intelligent agents with persistent memory, state management, and cognitive capabilities.

## ✨ Features

- **Domain-Driven Design Architecture**: Clean separation of concerns (Domain, Application, Infrastructure)
- **Rich Domain Model**: `MemoryRecord` aggregate with full lifecycle management (Active, Archived, Forgotten, Deleted)
- **Event-Driven**: Domain events for memory changes and state transitions
- **Immutable & Testable**: Snapshot/reconstitute pattern + deterministic testing with FakeClock
- **Persistence Ready**: SQLite adapter (better-sqlite3) with repository pattern
- **TypeScript First**: Full type safety and modern development experience
- **Comprehensive Testing**: Jest unit tests with high coverage focus on domain logic

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/icezingza/sovereign-platform-v3.git
cd sovereign-platform-v3

# 2. Install dependencies
npm ci

# 3. Type check
npm run typecheck

# 4. Run tests
npm test

# 5. Run tests in watch mode
npm run test:watch
```

## Project Structure

```
src/
├── domain/           # Core business logic (no external dependencies)
│   └── memory/       # MemoryRecord aggregate, value objects, events, errors
├── application/      # Use cases and orchestrators
├── infrastructure/   # Adapters (repositories, persistence, external services)
└── __tests__/        # Unit and integration tests
```

**Key Patterns**:
- **Domain**: Pure business rules
- **Application**: Coordinates use cases without business logic
- **Infrastructure**: Concrete implementations

## Core Concepts

- **MemoryRecord**: The central entity representing a piece of knowledge or experience
- **MemoryStatus**: Lifecycle states with clear transition rules
- **Snapshot/Reconstitute**: For persistence and event sourcing compatibility
- **Domain Events**: Track changes in memory state

## Scripts

- `npm run typecheck` — TypeScript compilation check
- `npm test` — Run all tests
- `npm run test:coverage` — Tests with coverage report
- `npm run test:watch` — Watch mode for development

## Roadmap to Production / Commercialization

1. **Documentation** (In Progress)
2. **npm Package** publishing
3. **Example Applications** (Agent memory integration)
4. **Advanced Features** (Memory retrieval strategies, forgetting curves, vector search integration)
5. **API Layer** (REST/GraphQL if needed)
6. **Deployment Examples** (Docker, cloud)

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Run `npm run typecheck` and `npm test`
4. Submit a Pull Request

See `CLAUDE.md` for detailed architecture notes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for sovereign AI systems**