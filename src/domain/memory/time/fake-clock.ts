import { TimeProvider } from './time-provider.interface';

export class FakeClock implements TimeProvider {
  private _current: Date;

  constructor(initial: Date = new Date('2024-01-01T00:00:00.000Z')) {
    this._current = new Date(initial.getTime());
  }

  now(): Date {
    return new Date(this._current.getTime());
  }

  tick(ms: number): void {
    this._current = new Date(this._current.getTime() + ms);
  }

  set(date: Date): void {
    this._current = new Date(date.getTime());
  }
}
