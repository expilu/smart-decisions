import { describe, expect, it } from 'vitest';
import { backoffDelay } from '../../../src/utils/network/backoff-delay.js';

describe('backoffDelay', () => {
  it('doubles per attempt and caps at 8s', () => {
    expect(backoffDelay(0)).toBe(500);
    expect(backoffDelay(1)).toBe(1000);
    expect(backoffDelay(2)).toBe(2000);
    expect(backoffDelay(3)).toBe(4000);
    expect(backoffDelay(4)).toBe(8000);
    expect(backoffDelay(5)).toBe(8000); // capped
    expect(backoffDelay(99)).toBe(8000);
  });
});
