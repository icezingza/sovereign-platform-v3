export interface DomainEventProps {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
}

export abstract class DomainEvent {
  abstract readonly eventType: string;
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
  readonly schemaVersion: number = 1;

  constructor(props: DomainEventProps) {
    this.eventId = props.eventId;
    this.aggregateId = props.aggregateId;
    this.aggregateVersion = props.aggregateVersion;
    this.occurredAt = props.occurredAt;
  }
}
