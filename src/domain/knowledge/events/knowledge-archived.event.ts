import { DomainEvent, DomainEventProps } from '../../memory/events/domain-event';

export class KnowledgeArchivedEvent extends DomainEvent {
  readonly eventType = 'KnowledgeArchived' as const;

  constructor(props: DomainEventProps) {
    super(props);
  }
}
