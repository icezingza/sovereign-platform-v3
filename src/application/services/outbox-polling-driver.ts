import { OutboxProcessor } from './outbox-processor';

export class OutboxPollingDriver {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;

  constructor(
    private readonly processor: OutboxProcessor,
    private readonly intervalMs: number,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.timer = setTimeout(async () => {
      try {
        await this.processor.processPending();
      } catch (error) {
        this.onError(error);
      } finally {
        this.scheduleNext();
      }
    }, this.intervalMs);
  }
}
