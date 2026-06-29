import { DomainEvent, DomainEventProps } from './domain-event';

export class MemoryArchivedEvent extends DomainEvent {
  readonly eventType = 'MemoryArchived' as const;

  constructor(props: DomainEventProps) {
    super(props);
  }
}
