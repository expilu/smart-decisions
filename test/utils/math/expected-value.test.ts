import { describe, expect, it } from 'vitest';
import { expectedValue } from '../../../src/utils/math/expected-value.js';

describe('expectedValue', () => {
  it('returns the level number holding all the probability', () => {
    expect(expectedValue([0, 1, 0])).toBe(1);
    expect(expectedValue([1, 0, 0])).toBe(0);
  });

  it('lands between levels when the probability splits', () => {
    // Half on level 1, half on level 2 → 1.5: the visible between-two-levels case.
    expect(expectedValue([0, 0.5, 0.5])).toBe(1.5);
    expect(expectedValue([0.25, 0.25, 0.25, 0.25])).toBe(1.5);
  });

  it('weights levels by their probability (the score math shared by both modes)', () => {
    expect(expectedValue([0.57, 0.43])).toBeCloseTo(0.43, 10);
    expect(expectedValue([0, 0, 1, 0, 0])).toBe(2);
  });

  it('sums an empty distribution to 0', () => {
    expect(expectedValue([])).toBe(0);
  });
});
