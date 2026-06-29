import { DomainEvent, DomainEventProps } from './domain-event';

interface KnowledgeLinkedProps extends DomainEventProps {
  readonly knowledgeId: string;
}

export class KnowledgeLinkedEvent extends DomainEvent {
  readonly eventType = 'KnowledgeLinked' as const;
  readonly knowledgeId: string;

  constructor(props: KnowledgeLinkedProps) {
    super(props);
    this.knowledgeId = props.knowledgeId;
  }
}
