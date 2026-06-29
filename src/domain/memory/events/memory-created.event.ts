import { DomainEvent, DomainEventProps } from './domain-event';

interface MemoryCreatedProps extends DomainEventProps {
  readonly content: string;
  readonly importance: number;
}

export class MemoryCreatedEvent extends DomainEvent {
  readonly eventType = 'MemoryCreated' as const;
  readonly content: string;
  readonly importance: number;

  constructor(props: MemoryCreatedProps) {
    super(props);
    this.content = props.content;
    this.importance = props.importance;
  }
}
