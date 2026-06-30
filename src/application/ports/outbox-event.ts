export interface OutboxEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly schemaVersion: number;
  readonly payload: Record<string, unknown>;
}
