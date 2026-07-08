import { randomUUID } from 'crypto';

import { EventConsumer } from '../../../application/ports/event-consumer.interface';
import { OutboxEvent } from '../../../application/ports/outbox-event';
import { OutboxProcessor } from '../../../application/services/outbox-processor';
import { DispatchingEventBus } from '../../../infrastructure/events/dispatching.event-bus';
import { InMemoryEventBus } from '../../../infrastructure/events/in-memory.event-bus';
import { InMemoryOutboxRepository } from '../../../infrastructure/persistence/outbox/in-memory.outbox-repository';

const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

function makeEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    eventId: randomUUID(),
    aggregateId: randomUUID(),
    eventType: 'MemoryCreated',
    occurredAt: BASE_DATE,
    schemaVersion: 1,
    payload: {},
    ...overrides,
  };
}

class RecordingConsumer implements EventConsumer {
  readonly received: OutboxEvent[] = [];

  constructor(readonly eventType: string) {}

  async handle(event: OutboxEvent): Promise<void> {
    this.received.push(event);
  }
}

describe('OutboxProcessor', () => {
  it('publishes unprocessed events to the event bus and marks them processed', async () => {
    const outbox = new InMemoryOutboxRepository();
    const eventBus = new InMemoryEventBus();
    const processor = new OutboxProcessor(outbox, eventBus);
    const event = makeEvent();
    await outbox.append([event]);

    const count = await processor.processPending();

    expect(count).toBe(1);
    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0].eventId).toBe(event.eventId);
    expect(await outbox.findUnprocessed()).toHaveLength(0);
  });

  it('returns 0 and does not call the event bus when there is nothing pending', async () => {
    const outbox = new InMemoryOutboxRepository();
    const eventBus = new InMemoryEventBus();
    const publishSpy = jest.spyOn(eventBus, 'publish');
    const processor = new OutboxProcessor(outbox, eventBus);

    const count = await processor.processPending();

    expect(count).toBe(0);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('does not reprocess events already marked processed', async () => {
    const outbox = new InMemoryOutboxRepository();
    const eventBus = new InMemoryEventBus();
    const processor = new OutboxProcessor(outbox, eventBus);
    await outbox.append([makeEvent()]);

    await processor.processPending();
    const secondRun = await processor.processPending();

    expect(secondRun).toBe(0);
    expect(eventBus.events).toHaveLength(1);
  });

  it('respects the limit parameter', async () => {
    const outbox = new InMemoryOutboxRepository();
    const eventBus = new InMemoryEventBus();
    const processor = new OutboxProcessor(outbox, eventBus);
    await outbox.append([makeEvent(), makeEvent(), makeEvent()]);

    const count = await processor.processPending(2);

    expect(count).toBe(2);
    expect(await outbox.findUnprocessed()).toHaveLength(1);
  });

  it('routes events to registered EventConsumers by eventType via DispatchingEventBus', async () => {
    const outbox = new InMemoryOutboxRepository();
    const dispatchingBus = new DispatchingEventBus();
    const archivedConsumer = new RecordingConsumer('MemoryArchived');
    const createdConsumer = new RecordingConsumer('MemoryCreated');
    dispatchingBus.register(archivedConsumer);
    dispatchingBus.register(createdConsumer);

    const processor = new OutboxProcessor(outbox, dispatchingBus);
    await outbox.append([makeEvent({ eventType: 'MemoryArchived' })]);

    await processor.processPending();

    expect(archivedConsumer.received).toHaveLength(1);
    expect(createdConsumer.received).toHaveLength(0);
  });

  it('does not throw when no consumer is registered for an eventType', async () => {
    const outbox = new InMemoryOutboxRepository();
    const dispatchingBus = new DispatchingEventBus();
    const processor = new OutboxProcessor(outbox, dispatchingBus);
    await outbox.append([makeEvent({ eventType: 'UnregisteredType' })]);

    await expect(processor.processPending()).resolves.toBe(1);
  });
});
