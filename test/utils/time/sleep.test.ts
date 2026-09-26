import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '../../../src/utils/time/sleep.js';

describe('sleep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves only after the requested delay', async () => {
    const pending = sleep(500);
    const watcher = pending.then(() => true);
    await vi.advanceTimersByTimeAsync(499);
    // Not resolved yet: the wait is a real timer, honored through fake timers.
    expect(await Promise.race([watcher, Promise.resolve(false)])).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await watcher).toBe(true);
    await pending;
  });
});
