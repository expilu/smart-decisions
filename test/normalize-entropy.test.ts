import { describe, expect, it } from 'vitest';
import { normalizeEntropy } from '../src/utils/math/normalize-entropy.js';

describe('normalizeEntropy', () => {
  it('returns 0 for a uniform (flat) distribution', () => {
    expect(normalizeEntropy([0.5, 0.5])).toBeCloseTo(0);
    expect(normalizeEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(0);
  });

  it('returns 1 for a fully peaked distribution', () => {
    expect(normalizeEntropy([1, 0])).toBe(1);
    expect(normalizeEntropy([0, 0, 1])).toBe(1);
  });

  it('returns partial confidence for a leaned distribution (0.75/0.25)', () => {
    // Shape of the message: 1 - H/ln(n). For [0.75, 0.25] the Shannon entropy is 0.562335,
    // and ln(2) = 0.693147, so the value below is derived analytically, not hard-coded.
    expect(
      normalizeEntropy([0.75, 0.25]),
    ).toBeCloseTo(1 + (0.75 * Math.log(0.75) + 0.25 * Math.log(0.25)) / Math.log(2));
  });

  it('accounts for the number of options in the normalization', () => {
    // [0.5,0.5,0,0]: entropy = ln(2) but max entropy = ln(4), so H_normalized = 1/2
    // and the complement is exactly 0.5 — zeros still count towards n.
    expect(normalizeEntropy([0.5, 0.5, 0, 0])).toBeCloseTo(0.5);
  });

  it('always lands in 0..1 for valid probability distributions', () => {
    for (let i = 0; i < 50; i++) {
      const rand = (n: number) => {
        const parts = Array.from({ length: n }, () => Math.random()) as number[];
        const sum = parts.reduce((s, p) => s + p, 0);
        return parts.map((p) => p / sum);
      };
      const probs = rand(2 + Math.floor(i / 5));
      const value = normalizeEntropy(probs);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('peaked with non-extreme max gives partial confidence (matches ConfidenceAnswer doc)', () => {
    expect(normalizeEntropy([0.6, 0.4])).toBeGreaterThan(0);
    expect(normalizeEntropy([0.6, 0.4])).toBeLessThan(1);
  });
});
