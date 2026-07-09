/**
 * Basic usage — the MemoryRecord aggregate on its own (no persistence).
 *
 * Run from the repository root:
 *   npx tsx examples/basic-usage.ts
 */
import { randomUUID } from 'crypto';

import {
  Importance,
  InvalidStateTransitionError,
  KnowledgeId,
  MemoryId,
  MemoryRecord,
  SystemClock,
} from '../src';

function main() {
  const clock = new SystemClock();

  // 1. Create a memory. Content is required; importance is an integer 1–10.
  const memory = MemoryRecord.create(
    MemoryId.create(randomUUID()),
    'First meeting with the AI development team',
    Importance.create(8),
    clock,
  );
  console.log('Created:', memory.content);
  console.log('Status:', memory.status, '| version:', memory.version);

  // 2. Link knowledge (idempotent — linking the same id twice is a no-op).
  const knowledgeId = KnowledgeId.create(randomUUID());
  memory.linkKnowledge(knowledgeId, clock);
  memory.linkKnowledge(knowledgeId, clock); // no-op, version unchanged
  console.log('References:', memory.references.map((r) => r.value));
  console.log('Version after link:', memory.version);

  // 3. Walk the state machine: ACTIVE -> ARCHIVED -> ACTIVE.
  memory.archive(clock);
  console.log('Archived. Status:', memory.status, '| version:', memory.version);
  memory.restore(clock);
  console.log('Restored. Status:', memory.status, '| version:', memory.version);

  // 4. Every mutation queued a domain event. pullEvents() drains the queue.
  const events = memory.pullEvents();
  console.log('Domain events:', events.map((e) => e.constructor.name));
  console.log('Queue after pull:', memory.pullEvents().length); // 0

  // 5. Snapshot round-trip — the DTO boundary used by the persistence layer.
  const snapshot = memory.toSnapshot();
  const restored = MemoryRecord.reconstitute(snapshot);
  console.log('Reconstituted version:', restored.version, '| status:', restored.status);

  // 6. Invalid transitions throw BEFORE mutating anything.
  restored.forget(clock); // ACTIVE -> FORGOTTEN (terminal)
  try {
    restored.archive(clock); // FORGOTTEN is terminal
  } catch (error) {
    if (error instanceof InvalidStateTransitionError) {
      console.log('Rejected as expected:', error.message);
    } else {
      throw error;
    }
  }
}

main();
