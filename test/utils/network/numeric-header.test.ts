import { describe, expect, it } from 'vitest';
import { numericHeader } from '../../../src/utils/network/numeric-header.js';

describe('numericHeader', () => {
  it('returns undefined when the header is absent', () => {
    expect(numericHeader(null, 1, 60_000)).toBeUndefined();
  });

  it('parses numeric values scaled by the multiplier', () => {
    expect(numericHeader('250', 1, 60_000)).toBe(250); // milliseconds
    expect(numericHeader('2', 1000, 60_000)).toBe(2000); // seconds
  });

  it('returns undefined for non-numeric values (e.g. an HTTP-date)', () => {
    expect(numericHeader('Sat, 26 Sep 2026 12:00:00 GMT', 1000, 60_000)).toBeUndefined();
  });

  it('rejects negative and above-cap values', () => {
    expect(numericHeader('-5', 1, 60_000)).toBeUndefined();
    expect(numericHeader('120', 1000, 60_000)).toBeUndefined(); // 120s > 60s cap
  });

  it('accepts the boundary value at the cap', () => {
    expect(numericHeader('60', 1000, 60_000)).toBe(60_000);
  });
});
