import { DomainEvent, DomainEventProps } from './domain-event';

export class MemoryForgottenEvent extends DomainEvent {
  readonly eventType = 'MemoryForgotten' as const;

  constructor(props: DomainEventProps) {
    super(props);
  }
}
