import { DomainEvent, DomainEventProps } from '../../memory/events/domain-event';

export class KnowledgeRestoredEvent extends DomainEvent {
  readonly eventType = 'KnowledgeRestored' as const;

  constructor(props: DomainEventProps) {
    super(props);
  }
}
