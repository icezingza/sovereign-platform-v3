import { TimeProvider } from './time-provider.interface';

export class SystemClock implements TimeProvider {
  now(): Date {
    return new Date();
  }
}
