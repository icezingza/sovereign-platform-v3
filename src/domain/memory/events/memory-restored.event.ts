import { DomainEvent, DomainEventProps } from './domain-event';

export class MemoryRestoredEvent extends DomainEvent {
  readonly eventType = 'MemoryRestored' as const;

  constructor(props: DomainEventProps) {
    super(props);
  }
}
