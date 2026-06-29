import { DomainEvent, DomainEventProps } from './domain-event';

export class MemoryDeletedEvent extends DomainEvent {
  readonly eventType = 'MemoryDeleted' as const;

  constructor(props: DomainEventProps) {
    super(props);
  }
}
