import { randomUUID } from 'crypto';

import { InvalidOperationError, InvalidStateTransitionError } from '../../../domain/memory/errors/domain-error';
import { KnowledgeLinkedEvent } from '../../../domain/memory/events/knowledge-linked.event';
import { MemoryArchivedEvent } from '../../../domain/memory/events/memory-archived.event';
import { MemoryCreatedEvent } from '../../../domain/memory/events/memory-created.event';
import { MemoryDeletedEvent } from '../../../domain/memory/events/memory-deleted.event';
import { MemoryForgottenEvent } from '../../../domain/memory/events/memory-forgotten.event';
import { MemoryRestoredEvent } from '../../../domain/memory/events/memory-restored.event';
import { MemoryRecord } from '../../../domain/memory/memory-record';
import { MemoryStatus } from '../../../domain/memory/memory-status';
import { FakeClock } from '../../../domain/memory/time/fake-clock';
import { Importance } from '../../../domain/memory/value-objects/importance';
import { KnowledgeId } from '../../../domain/memory/value-objects/knowledge-id';
import { MemoryId } from '../../../domain/memory/value-objects/memory-id';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

function makeMemory(clock = new FakeClock(BASE_DATE)): MemoryRecord {
  return MemoryRecord.create(
    MemoryId.create(randomUUID()),
    'Test memory content',
    Importance.create(5),
    clock,
  );
}

describe('MemoryRecord', () => {
  // ─── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates an ACTIVE memory at version 1', () => {
      const memory = makeMemory();
      expect(memory.status).toBe(MemoryStatus.ACTIVE);
      expect(memory.version).toBe(1);
    });

    it('emits a MemoryCreatedEvent with correct payload', () => {
      const clock = new FakeClock(BASE_DATE);
      const memory = makeMemory(clock);
      const [event] = memory.pullEvents();

      expect(event).toBeInstanceOf(MemoryCreatedEvent);
      expect((event as MemoryCreatedEvent).importance).toBe(5);
      expect(event.aggregateVersion).toBe(1);
      expect(event.occurredAt).toEqual(BASE_DATE);
    });

    it('records createdAt and updatedAt from the clock', () => {
      const clock = new FakeClock(BASE_DATE);
      const memory = makeMemory(clock);
      expect(memory.createdAt).toEqual(BASE_DATE);
      expect(memory.updatedAt).toEqual(BASE_DATE);
    });

    it('throws InvalidOperationError for empty content', () => {
      expect(() =>
        MemoryRecord.create(MemoryId.create(randomUUID()), '  ', Importance.create(1), new FakeClock(BASE_DATE)),
      ).toThrow(InvalidOperationError);
    });
  });

  // ─── State Machine — valid transitions ───────────────────────────────────────

  describe('State Machine — valid transitions', () => {
    it('ACTIVE → ARCHIVED', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      expect(m.status).toBe(MemoryStatus.ARCHIVED);
    });

    it('ARCHIVED → ACTIVE', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      m.restore(clock);
      expect(m.status).toBe(MemoryStatus.ACTIVE);
    });

    it('ACTIVE → FORGOTTEN', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.forget(clock);
      expect(m.status).toBe(MemoryStatus.FORGOTTEN);
    });

    it('ACTIVE → DELETED', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.delete(clock);
      expect(m.status).toBe(MemoryStatus.DELETED);
    });

    it('ARCHIVED → DELETED', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      m.delete(clock);
      expect(m.status).toBe(MemoryStatus.DELETED);
    });
  });

  // ─── State Machine — invalid transitions (throw + no side effects) ────────

  describe('State Machine — invalid transitions', () => {
    function assertNoSideEffects(
      m: MemoryRecord,
      action: () => void,
      expectedStatus: MemoryStatus,
    ): void {
      const vBefore = m.version;
      m.pullEvents();

      expect(action).toThrow(InvalidStateTransitionError);
      expect(m.status).toBe(expectedStatus);
      expect(m.version).toBe(vBefore);
      expect(m.pullEvents()).toHaveLength(0);
    }

    it('ARCHIVED.archive() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      assertNoSideEffects(m, () => m.archive(clock), MemoryStatus.ARCHIVED);
    });

    it('ACTIVE.restore() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      assertNoSideEffects(m, () => m.restore(clock), MemoryStatus.ACTIVE);
    });

    it('FORGOTTEN.restore() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.forget(clock);
      assertNoSideEffects(m, () => m.restore(clock), MemoryStatus.FORGOTTEN);
    });

    it('FORGOTTEN.archive() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.forget(clock);
      assertNoSideEffects(m, () => m.archive(clock), MemoryStatus.FORGOTTEN);
    });

    it('FORGOTTEN.forget() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.forget(clock);
      assertNoSideEffects(m, () => m.forget(clock), MemoryStatus.FORGOTTEN);
    });

    it('FORGOTTEN.delete() throws — no side effects (FORGOTTEN is terminal)', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.forget(clock);
      assertNoSideEffects(m, () => m.delete(clock), MemoryStatus.FORGOTTEN);
    });

    it('DELETED.delete() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.delete(clock);
      assertNoSideEffects(m, () => m.delete(clock), MemoryStatus.DELETED);
    });

    it('DELETED.archive() throws — no side effects', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.delete(clock);
      assertNoSideEffects(m, () => m.archive(clock), MemoryStatus.DELETED);
    });
  });

  // ─── Versioning ───────────────────────────────────────────────────────────────

  describe('Versioning', () => {
    it('increments on every state change', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      expect(m.version).toBe(1);

      m.archive(clock);
      expect(m.version).toBe(2);

      m.restore(clock);
      expect(m.version).toBe(3);

      m.forget(clock);
      expect(m.version).toBe(4);
    });

    it('increments when linking knowledge', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('k1'), clock);
      expect(m.version).toBe(2);
    });

    it('does NOT increment on a failed transition', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      const vBefore = m.version;

      try { m.archive(clock); } catch { /* expected */ }

      expect(m.version).toBe(vBefore);
    });
  });

  // ─── Event System ─────────────────────────────────────────────────────────────

  describe('Event System', () => {
    it('archive() emits MemoryArchivedEvent matching the new version', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();

      m.archive(clock);
      const [event] = m.pullEvents();

      expect(event).toBeInstanceOf(MemoryArchivedEvent);
      expect(event.aggregateVersion).toBe(m.version);
    });

    it('restore() emits MemoryRestoredEvent', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      m.pullEvents();

      m.restore(clock);
      expect(m.pullEvents()[0]).toBeInstanceOf(MemoryRestoredEvent);
    });

    it('forget() emits MemoryForgottenEvent', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();

      m.forget(clock);
      expect(m.pullEvents()[0]).toBeInstanceOf(MemoryForgottenEvent);
    });

    it('delete() emits MemoryDeletedEvent', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();

      m.delete(clock);
      expect(m.pullEvents()[0]).toBeInstanceOf(MemoryDeletedEvent);
    });

    it('linkKnowledge() emits KnowledgeLinkedEvent with correct knowledgeId', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();

      m.linkKnowledge(KnowledgeId.create('kb-001'), clock);
      const [event] = m.pullEvents();

      expect(event).toBeInstanceOf(KnowledgeLinkedEvent);
      expect((event as KnowledgeLinkedEvent).knowledgeId).toBe('kb-001');
    });

    it('events have unique eventIds', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      m.restore(clock);

      const ids = m.pullEvents().map((e) => e.eventId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('events are ordered by occurrence', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      clock.tick(100);
      m.archive(clock);
      clock.tick(100);
      m.restore(clock);

      const events = m.pullEvents();
      expect(events[0]).toBeInstanceOf(MemoryCreatedEvent);
      expect(events[1]).toBeInstanceOf(MemoryArchivedEvent);
      expect(events[2]).toBeInstanceOf(MemoryRestoredEvent);
    });

    it('pullEvents() clears the queue', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();
      expect(m.pullEvents()).toHaveLength(0);
    });

    it('failed transition does NOT add an event', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      m.pullEvents();

      try { m.archive(clock); } catch { /* expected */ }

      expect(m.pullEvents()).toHaveLength(0);
    });

    it('events carry schemaVersion = 1', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      const [event] = m.pullEvents();
      expect(event.schemaVersion).toBe(1);
    });
  });

  // ─── Deterministic Time ───────────────────────────────────────────────────────

  describe('Deterministic Time', () => {
    it('event occurredAt matches clock.now() at the moment of transition', () => {
      const archiveTime = new Date('2024-06-01T12:00:00.000Z');
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();

      clock.set(archiveTime);
      m.archive(clock);

      const [event] = m.pullEvents();
      expect(event.occurredAt).toEqual(archiveTime);
    });

    it('updatedAt reflects the clock at the time of each transition', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);

      const archiveTime = new Date('2024-02-01T00:00:00.000Z');
      clock.set(archiveTime);
      m.archive(clock);

      expect(m.updatedAt).toEqual(archiveTime);
    });
  });

  // ─── Metadata Integrity ───────────────────────────────────────────────────────

  describe('Metadata Integrity', () => {
    it('archive() does not change content, importance, or references', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('k1'), clock);
      const contentBefore = m.content;
      const importanceBefore = m.importance.value;
      const refsBefore = m.references.map((r) => r.value);
      m.pullEvents();

      m.archive(clock);

      expect(m.content).toBe(contentBefore);
      expect(m.importance.value).toBe(importanceBefore);
      expect(m.references.map((r) => r.value)).toEqual(refsBefore);
    });

    it('restore() does not change content or importance', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);
      const contentBefore = m.content;
      const importanceBefore = m.importance.value;

      m.restore(clock);

      expect(m.content).toBe(contentBefore);
      expect(m.importance.value).toBe(importanceBefore);
    });
  });

  // ─── linkKnowledge() ─────────────────────────────────────────────────────────

  describe('linkKnowledge()', () => {
    it('adds the KnowledgeId to references', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      const kId = KnowledgeId.create('kb-001');

      m.linkKnowledge(kId, clock);

      expect(m.references.some((r) => r.equals(kId))).toBe(true);
    });

    it('is idempotent — linking the same value twice does not duplicate', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('kb-001'), clock);
      m.linkKnowledge(KnowledgeId.create('kb-001'), clock); // different object, same value

      expect(m.references.filter((r) => r.value === 'kb-001')).toHaveLength(1);
    });

    it('idempotent link does NOT increment version or emit event', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('kb-001'), clock);
      const vBefore = m.version;
      m.pullEvents();

      m.linkKnowledge(KnowledgeId.create('kb-001'), clock);

      expect(m.version).toBe(vBefore);
      expect(m.pullEvents()).toHaveLength(0);
    });

    it('throws InvalidOperationError on ARCHIVED memory', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.archive(clock);

      expect(() => m.linkKnowledge(KnowledgeId.create('kb-001'), clock)).toThrow(InvalidOperationError);
    });

    it('throws InvalidOperationError on FORGOTTEN memory', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.forget(clock);

      expect(() => m.linkKnowledge(KnowledgeId.create('kb-001'), clock)).toThrow(InvalidOperationError);
    });

    it('references getter returns a defensive copy — external mutation does not affect aggregate', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('kb-001'), clock);

      (m.references as KnowledgeId[]).push(KnowledgeId.create('injected'));

      expect(m.references).toHaveLength(1);
    });
  });

  // ─── Snapshot / Reconstitution ────────────────────────────────────────────────

  describe('Snapshot / Reconstitution', () => {
    it('toSnapshot() returns a frozen object with correct values', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.pullEvents();

      const snap = m.toSnapshot();

      expect(Object.isFrozen(snap)).toBe(true);
      expect(snap.status).toBe(MemoryStatus.ACTIVE);
      expect(snap.version).toBe(1);
      expect(snap.content).toBe('Test memory content');
      expect(snap.importance).toBe(5);
    });

    it('snapshot references array is frozen', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('k1'), clock);

      expect(Object.isFrozen(m.toSnapshot().references)).toBe(true);
    });

    it('reconstitute() rebuilds the aggregate with no pending events', () => {
      const clock = new FakeClock(BASE_DATE);
      const original = makeMemory(clock);
      original.archive(clock);
      const snap = original.toSnapshot();

      const rebuilt = MemoryRecord.reconstitute(snap);

      expect(rebuilt.status).toBe(MemoryStatus.ARCHIVED);
      expect(rebuilt.version).toBe(2);
      expect(rebuilt.content).toBe(original.content);
      expect(rebuilt.pullEvents()).toHaveLength(0);
    });

    it('reconstituted aggregate can continue state transitions', () => {
      const clock = new FakeClock(BASE_DATE);
      const original = makeMemory(clock);
      original.archive(clock);

      const rebuilt = MemoryRecord.reconstitute(original.toSnapshot());
      rebuilt.restore(clock);

      expect(rebuilt.status).toBe(MemoryStatus.ACTIVE);
      expect(rebuilt.version).toBe(3);
    });

    it('reconstitute() restores references correctly', () => {
      const clock = new FakeClock(BASE_DATE);
      const m = makeMemory(clock);
      m.linkKnowledge(KnowledgeId.create('k1'), clock);
      m.linkKnowledge(KnowledgeId.create('k2'), clock);

      const rebuilt = MemoryRecord.reconstitute(m.toSnapshot());

      expect(rebuilt.references).toHaveLength(2);
      expect(rebuilt.references[0].value).toBe('k1');
      expect(rebuilt.references[1].value).toBe('k2');
    });
  });

  // ─── Value Object semantics ───────────────────────────────────────────────────

  describe('Value Object Equality', () => {
    it('MemoryId equality is value-based, not reference-based', () => {
      const a = MemoryId.create('same');
      const b = MemoryId.create('same');
      const c = MemoryId.create('other');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
      expect(a === b).toBe(false);
    });

    it('KnowledgeId equality is value-based', () => {
      const a = KnowledgeId.create('kb-001');
      const b = KnowledgeId.create('kb-001');
      expect(a.equals(b)).toBe(true);
      expect(a === b).toBe(false);
    });

    it('Importance equality is value-based', () => {
      expect(Importance.create(5).equals(Importance.create(5))).toBe(true);
      expect(Importance.create(5).equals(Importance.create(7))).toBe(false);
    });
  });

  describe('Value Object Validation', () => {
    it('MemoryId rejects empty string', () => {
      expect(() => MemoryId.create('')).toThrow();
      expect(() => MemoryId.create('  ')).toThrow();
    });

    it('Importance rejects out-of-range and non-integer values', () => {
      expect(() => Importance.create(0)).toThrow();
      expect(() => Importance.create(11)).toThrow();
      expect(() => Importance.create(1.5)).toThrow();
    });

    it('KnowledgeId rejects empty string', () => {
      expect(() => KnowledgeId.create('')).toThrow();
    });
  });
});
