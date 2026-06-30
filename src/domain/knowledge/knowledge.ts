import { randomUUID } from 'crypto';

import { InvalidOperationError, InvalidStateTransitionError } from '../memory/errors/domain-error';
import { DomainEvent } from '../memory/events/domain-event';
import { TimeProvider } from '../memory/time/time-provider.interface';
import { KnowledgeId } from '../memory/value-objects/knowledge-id';
import { KnowledgeArchivedEvent } from './events/knowledge-archived.event';
import { KnowledgeCreatedEvent } from './events/knowledge-created.event';
import { KnowledgeRestoredEvent } from './events/knowledge-restored.event';
import { KnowledgeSnapshot } from './knowledge-snapshot';
import { KnowledgeStatus } from './knowledge-status';

interface KnowledgeProps {
  id: KnowledgeId;
  content: string;
  status: KnowledgeStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Knowledge {
  private readonly _id: KnowledgeId;
  private readonly _content: string;
  private _status: KnowledgeStatus;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _events: DomainEvent[];

  private constructor(props: KnowledgeProps, events: DomainEvent[] = []) {
    this._id = props.id;
    this._content = props.content;
    this._status = props.status;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._events = [...events];
  }

  static create(id: KnowledgeId, content: string, clock: TimeProvider): Knowledge {
    const trimmed = content?.trim();
    if (!trimmed) throw new InvalidOperationError('Content cannot be empty');

    const now = clock.now();
    const version = 1;
    const knowledge = new Knowledge({
      id,
      content: trimmed,
      status: KnowledgeStatus.ACTIVE,
      version,
      createdAt: now,
      updatedAt: now,
    });
    knowledge._events.push(
      new KnowledgeCreatedEvent({
        eventId: randomUUID(),
        aggregateId: id.value,
        aggregateVersion: version,
        occurredAt: now,
        content: trimmed,
      }),
    );
    return knowledge;
  }

  static reconstitute(snapshot: KnowledgeSnapshot): Knowledge {
    return new Knowledge({
      id: KnowledgeId.create(snapshot.id),
      content: snapshot.content,
      status: snapshot.status,
      version: snapshot.version,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  archive(clock: TimeProvider): void {
    if (this._status !== KnowledgeStatus.ACTIVE) {
      throw new InvalidStateTransitionError(this._status, KnowledgeStatus.ARCHIVED);
    }
    const now = clock.now();
    this._status = KnowledgeStatus.ARCHIVED;
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new KnowledgeArchivedEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
      }),
    );
  }

  restore(clock: TimeProvider): void {
    if (this._status !== KnowledgeStatus.ARCHIVED) {
      throw new InvalidStateTransitionError(this._status, KnowledgeStatus.ACTIVE);
    }
    const now = clock.now();
    this._status = KnowledgeStatus.ACTIVE;
    this._version++;
    this._updatedAt = now;
    this._events.push(
      new KnowledgeRestoredEvent({
        eventId: randomUUID(),
        aggregateId: this._id.value,
        aggregateVersion: this._version,
        occurredAt: now,
      }),
    );
  }

  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }

  toSnapshot(): KnowledgeSnapshot {
    return Object.freeze({
      id: this._id.value,
      content: this._content,
      status: this._status,
      version: this._version,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    });
  }

  get id(): KnowledgeId { return this._id; }
  get content(): string { return this._content; }
  get status(): KnowledgeStatus { return this._status; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}
