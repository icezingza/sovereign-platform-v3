import { DomainEvent, DomainEventProps } from '../../memory/events/domain-event';

interface KnowledgeCreatedProps extends DomainEventProps {
  readonly content: string;
}

export class KnowledgeCreatedEvent extends DomainEvent {
  readonly eventType = 'KnowledgeCreated' as const;
  readonly content: string;

  constructor(props: KnowledgeCreatedProps) {
    super(props);
    this.content = props.content;
  }
}
