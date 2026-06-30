import { EventBus } from '../../application/ports/event-bus.interface';
import { EventConsumer } from '../../application/ports/event-consumer.interface';
import { OutboxEvent } from '../../application/ports/outbox-event';

export class DispatchingEventBus implements EventBus {
  private readonly consumers = new Map<string, EventConsumer[]>();

  register(consumer: EventConsumer): void {
    const list = this.consumers.get(consumer.eventType) ?? [];
    list.push(consumer);
    this.consumers.set(consumer.eventType, list);
  }

  async publish(events: OutboxEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.consumers.get(event.eventType) ?? [];
      await Promise.all(handlers.map((handler) => handler.handle(event)));
    }
  }
}
