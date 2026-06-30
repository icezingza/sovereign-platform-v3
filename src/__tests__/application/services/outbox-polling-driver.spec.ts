import { OutboxPollingDriver } from '../../../application/services/outbox-polling-driver';
import { OutboxProcessor } from '../../../application/services/outbox-processor';

function makeProcessor(processPending: jest.Mock): OutboxProcessor {
  return { processPending } as unknown as OutboxProcessor;
}

describe('OutboxPollingDriver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not call processPending before the interval elapses', () => {
    const processPending = jest.fn().mockResolvedValue(0);
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000);

    driver.start();

    expect(processPending).not.toHaveBeenCalled();
  });

  it('calls processPending after the interval elapses', async () => {
    const processPending = jest.fn().mockResolvedValue(0);
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000);

    driver.start();
    await jest.advanceTimersByTimeAsync(1000);

    expect(processPending).toHaveBeenCalledTimes(1);
  });

  it('schedules the next tick only after the current call settles, ticking repeatedly', async () => {
    const processPending = jest.fn().mockResolvedValue(0);
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000);

    driver.start();
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(1000);

    expect(processPending).toHaveBeenCalledTimes(3);
  });

  it('stops scheduling further calls once stop() is invoked', async () => {
    const processPending = jest.fn().mockResolvedValue(0);
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000);

    driver.start();
    await jest.advanceTimersByTimeAsync(1000);
    driver.stop();
    await jest.advanceTimersByTimeAsync(5000);

    expect(processPending).toHaveBeenCalledTimes(1);
  });

  it('routes errors from processPending to onError and keeps ticking', async () => {
    const processPending = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(0);
    const onError = jest.fn();
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000, onError);

    driver.start();
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error('boom'));
    expect(processPending).toHaveBeenCalledTimes(2);
  });

  it('calling start() twice does not create duplicate timers', async () => {
    const processPending = jest.fn().mockResolvedValue(0);
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000);

    driver.start();
    driver.start();
    await jest.advanceTimersByTimeAsync(1000);

    expect(processPending).toHaveBeenCalledTimes(1);
  });

  it('does not create duplicate timers when restarted while a tick is in flight', async () => {
    let resolvePending!: (value: number) => void;
    const pendingPromise = new Promise<number>((resolve) => {
      resolvePending = resolve;
    });
    const processPending = jest.fn().mockReturnValue(pendingPromise);
    const driver = new OutboxPollingDriver(makeProcessor(processPending), 1000);

    driver.start();
    await jest.advanceTimersByTimeAsync(1000);
    expect(processPending).toHaveBeenCalledTimes(1);

    driver.stop();
    driver.start();

    resolvePending(0);
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(1000);
    expect(processPending).toHaveBeenCalledTimes(2);
  });
});
