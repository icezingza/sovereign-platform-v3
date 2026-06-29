import { randomUUID } from 'crypto';

import { InvalidOperationError, InvalidStateTransitionError } from './errors/domain-error';
import { DomainEvent } from './events/domain-event';
import { KnowledgeLinkedEvent } from './events/knowledge-linked.event';
import { MemoryArchivedEvent } from './events/memory-archived.event';
import { MemoryCreatedEvent } from './events/memory-created.event';
import { MemoryDeletedEvent } from './events/memory-deleted.event';
import { MemoryForgottenEvent } from './events/memory-forgotten.event';
import { MemoryRestoredEvent } from './events/memory-restored.event';
import { MemorySnapshot } from './memory-snapshot';
import { MemoryStatus } from './memory-status';
import { TimeProvider } from './time/time-provider.interface';
import { Importance } from './value-objects/importance';
import { KnowledgeId } from './value-objects/knowledge-id';
import { MemoryId } from './value-objects/memory-id';

interface MemoryRecordProps {
  id: MemoryId;
  content: string;
  importance: Importance;
  status: MemoryStatus;
  references: KnowledgeId[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryRecord {
  private readonly _id: MemoryId;
  private readonly _content: string;
  private readonly _importance: Importance;
  private _status: MemoryStatus;
  private _references: KnowledgeId[];
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _events: DomainEvent[];

  private constructor(props: MemoryRecordProps, events: DomainEvent[] = []) {
    this._id = props.id;
    this._content = props.content;
    this._importance = props.importance;
    this._status = props.status;
    this._references = [...props.references];
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._events = [...events];
  }

  static create(
    id: MemoryId,
    content: string,
    importance: Importance,
    clock: TimeProvider,
  ): MemoryRecord {
    const trimmed = content?.trim();
    if (!trimmed) throw new InvalidOperationError('Content cannot be empty');

    const now = clock.now();
    const version = 1;
    const record = new MemoryRecord({
      id,
      content: trimmed,
      importance,
      status: MemoryStatus.ACTIVE,
      references: [],
      version,
      createdAt: now,
      updatedAt: now,
    });
    record._events.push(
      new MemoryCreatedEvent({
        eventId: randomUUID(),
        aggregateId: id.value,
        aggregateVersion: version,
        occurredAt: now,
        content: trimmed,
        importance: importance.value,
      }),
    );
    return record;
  }

  static reconstitute(snapshot: MemorySnapshot): MemoryRecord {
    return new MemoryRecord({
      id: MemoryId.create(snapshot.id),
      content: snapshot.content,
      importance: Importance.create(snapshot.importance),
      status: snapshot.status,
      references: snapshot.references.map((r) => KnowledgeId.create(r)),
      version: snapshot.version,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  archive(clock: TimeProvider): void {
    if (this._status !== MemoryStatus.ACTIVE) {
      throw new InvalidStateTransitionError(this._status, MemoryStatus.ARCHIVED);
    }
    const now = clock.now();
    this._status = MemoryStatus.ARCHIVED;
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new MemoryArchivedEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
      }),
    );
  }

  restore(clock: TimeProvider): void {
    if (this._status !== MemoryStatus.ARCHIVED) {
      throw new InvalidStateTransitionError(this._status, MemoryStatus.ACTIVE);
    }
    const now = clock.now();
    this._status = MemoryStatus.ACTIVE;
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new MemoryRestoredEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
      }),
    );
  }

  forget(clock: TimeProvider): void {
    if (this._status !== MemoryStatus.ACTIVE) {
      throw new InvalidStateTransitionError(this._status, MemoryStatus.FORGOTTEN);
    }
    const now = clock.now();
    this._status = MemoryStatus.FORGOTTEN;
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new MemoryForgottenEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
      }),
    );
  }

  delete(clock: TimeProvider): void {
    if (this._status === MemoryStatus.FORGOTTEN || this._status === MemoryStatus.DELETED) {
      throw new InvalidStateTransitionError(this._status, MemoryStatus.DELETED);
    }
    const now = clock.now();
    this._status = MemoryStatus.DELETED;
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new MemoryDeletedEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
      }),
    );
  }

  linkKnowledge(knowledgeId: KnowledgeId, clock: TimeProvider): void {
    if (this._status !== MemoryStatus.ACTIVE) {
      throw new InvalidOperationError(
        `Cannot link knowledge to a memory in ${this._status} state`,
      );
    }
    if (this._references.some((ref) => ref.equals(knowledgeId))) {
      return;
    }
    const now = clock.now();
    this._references = [...this._references, knowledgeId];
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new KnowledgeLinkedEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
        knowledgeId: knowledgeId.value,
      }),
    );
  }

  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  toSnapshot(): MemorySnapshot {
    return Object.freeze({
      id: this._id.value,
      content: this._content,
      importance: this._importance.value,
      status: this._status,
      references: Object.freeze([...this._references.map((r) => r.value)]),
      version: this._version,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  get id(): MemoryId { return this._id; }
  get content(): string { return this._content; }
  get importance(): Importance { return this._importance; }
  get status(): MemoryStatus { return this._status; }
  get references(): ReadonlyArray<KnowledgeId> { return [...this._references]; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}
