import { DomainEvent } from '../../domain/memory/events/domain-event';

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
}
