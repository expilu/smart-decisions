import { describe, expect, it } from 'vitest';
import { ratingsToProbabilities } from '../../../src/utils/math/ratings-to-probabilities.js';

describe('ratingsToProbabilities', () => {
  it('turns ratings into shares of the ratings mass', () => {
    expect(ratingsToProbabilities([8, 2])).toEqual([0.8, 0.2]);
    // A rated-0 candidate gets nothing — that is information, not absence.
    expect(ratingsToProbabilities([8, 2, 0])).toEqual([0.8, 0.2, 0]);
  });

  it('falls back to uniform when every rating is 0', () => {
    // Everything rated 0: "no decision among them", not a fake verdict.
    expect(ratingsToProbabilities([0, 0, 0])).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('gives the single rated candidate everything', () => {
    expect(ratingsToProbabilities([0, 7])).toEqual([0, 1]);
  });

  it('keeps custom distinct mass proportions exact', () => {
    expect(ratingsToProbabilities([1, 1, 6, 2])).toEqual([0.1, 0.1, 0.6, 0.2]);
  });

  it('throws on negative or non-finite ratings — a broken readout must not become a distribution', () => {
    expect(() => ratingsToProbabilities([-1, 2])).toThrow(
      'internal error: ratings must be finite non-negative numbers, got -1',
    );
    expect(() => ratingsToProbabilities([NaN, 2])).toThrow(/finite non-negative numbers/);
    // A JS caller's nullish slot counts too.
    expect(() => ratingsToProbabilities([null as unknown as number, 2])).toThrow(
      /finite non-negative numbers/,
    );
  });
});
