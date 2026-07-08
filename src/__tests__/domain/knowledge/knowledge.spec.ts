import { randomUUID } from 'crypto';

import { InvalidOperationError, InvalidStateTransitionError } from '../../../domain/memory/errors/domain-error';
import { FakeClock } from '../../../domain/memory/time/fake-clock';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { KnowledgeArchivedEvent } from '../../../domain/knowledge/events/knowledge-archived.event';
import { KnowledgeCreatedEvent } from '../../../domain/knowledge/events/knowledge-created.event';
import { KnowledgeRestoredEvent } from '../../../domain/knowledge/events/knowledge-restored.event';
import { Knowledge } from '../../../domain/knowledge/knowledge';
import { KnowledgeStatus } from '../../../domain/knowledge/knowledge-status';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

function makeKnowledge(clock = new FakeClock(BASE_DATE)): Knowledge {
  return Knowledge.create(KnowledgeId.create(randomUUID()), 'Test knowledge content', clock);
}

describe('Knowledge', () => {
  describe('create()', () => {
    it('creates an ACTIVE knowledge entry at version 1', () => {
      const knowledge = makeKnowledge();
      expect(knowledge.status).toBe(KnowledgeStatus.ACTIVE);
      expect(knowledge.version).toBe(1);
    });

    it('emits a KnowledgeCreatedEvent with correct payload', () => {
      const clock = new FakeClock(BASE_DATE);
      const knowledge = makeKnowledge(clock);
      const [event] = knowledge.pullEvents();

      expect(event).toBeInstanceOf(KnowledgeCreatedEvent);
      expect((event as KnowledgeCreatedEvent).content).toBe('Test knowledge content');
      expect(event.aggregateVersion).toBe(1);
      expect(event.occurredAt).toEqual(BASE_DATE);
    });

    it('records createdAt and updatedAt from the clock', () => {
      const clock = new FakeClock(BASE_DATE);
      const knowledge = makeKnowledge(clock);
      expect(knowledge.createdAt).toEqual(BASE_DATE);
      expect(knowledge.updatedAt).toEqual(BASE_DATE);
    });

    it('throws InvalidOperationError for empty content', () => {
      expect(() =>
        Knowledge.create(KnowledgeId.create(randomUUID()), '  ', new FakeClock(BASE_DATE)),
      ).toThrow(InvalidOperationError);
    });
  });

  describe('State Machine — valid transitions', () => {
    it('ACTIVE → ARCHIVED', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.archive(clock);
      expect(k.status).toBe(KnowledgeStatus.ARCHIVED);
    });

    it('ARCHIVED → ACTIVE', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.archive(clock);
      k.restore(clock);
      expect(k.status).toBe(KnowledgeStatus.ACTIVE);
    });
  });

  describe('State Machine — invalid transitions', () => {
    function assertNoSideEffects(
      k: Knowledge,
      action: () => void,
      expectedStatus: KnowledgeStatus,
    ): void {
      const vBefore = k.version;
      k.pullEvents();

      expect(action).toThrow(InvalidStateTransitionError);
      expect(k.status).toBe(expectedStatus);
      expect(k.version).toBe(vBefore);
      expect(k.pullEvents()).toHaveLength(0);
    }

    it('ACTIVE.restore() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      assertNoSideEffects(k, () => k.restore(clock), KnowledgeStatus.ACTIVE);
    });

    it('ARCHIVED.archive() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.archive(clock);
      assertNoSideEffects(k, () => k.archive(clock), KnowledgeStatus.ARCHIVED);
    });
  });

  describe('Versioning', () => {
    it('increments on every state change', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      expect(k.version).toBe(1);

      k.archive(clock);
      expect(k.version).toBe(2);

      k.restore(clock);
      expect(k.version).toBe(3);
    });

    it('does NOT increment on a failed transition', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      const vBefore = k.version;

      try { k.restore(clock); } catch { /* expected */ }

      expect(k.version).toBe(vBefore);
    });
  });

  describe('Event System', () => {
    it('archive() emits KnowledgeArchivedEvent matching the new version', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.pullEvents();

      k.archive(clock);
      const [event] = k.pullEvents();

      expect(event).toBeInstanceOf(KnowledgeArchivedEvent);
      expect(event.aggregateVersion).toBe(k.version);
    });

    it('restore() emits KnowledgeRestoredEvent', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.archive(clock);
      k.pullEvents();

      k.restore(clock);
      expect(k.pullEvents()[0]).toBeInstanceOf(KnowledgeRestoredEvent);
    });

    it('events have unique eventIds', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.archive(clock);
      k.restore(clock);

      const ids = k.pullEvents().map((e) => e.eventId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('pullEvents() clears the queue', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.pullEvents();
      expect(k.pullEvents()).toHaveLength(0);
    });

    it('failed transition does NOT add an event', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.pullEvents();

      try { k.restore(clock); } catch { /* expected */ }

      expect(k.pullEvents()).toHaveLength(0);
    });

    it('events carry schemaVersion = 1', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      const [event] = k.pullEvents();
      expect(event.schemaVersion).toBe(1);
    });
  });

  describe('Metadata Integrity', () => {
    it('archive() does not change content', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      const contentBefore = k.content;
      k.pullEvents();

      k.archive(clock);

      expect(k.content).toBe(contentBefore);
    });
  });

  describe('Snapshot round-trip', () => {
    it('toSnapshot() → reconstitute() preserves state and allows resuming transitions', () => {
      const clock = new FakeClock(BASE_DATE);
      const k = makeKnowledge(clock);
      k.archive(clock);
      const snapshot = k.toSnapshot();

      const resumed = Knowledge.reconstitute(snapshot);
      expect(resumed.status).toBe(KnowledgeStatus.ARCHIVED);
      expect(resumed.version).toBe(2);
      expect(resumed.pullEvents()).toHaveLength(0);

      resumed.restore(clock);
      expect(resumed.status).toBe(KnowledgeStatus.ACTIVE);
      expect(resumed.version).toBe(3);
    });

    it('toSnapshot() returns a frozen object', () => {
      const k = makeKnowledge();
      const snapshot = k.toSnapshot();
      expect(Object.isFrozen(snapshot)).toBe(true);
    });
  });
});
