/**
 * Computes the expected value of a probability distribution over equally
 * spaced levels 0..n-1 — the position on the spectrum `score()` returns.
 *
 * The value can fall between two levels: half the probability on level 1 and
 * half on level 2 is a score of 1.5. This is shared math — System 1 computes
 * the distribution from letter/digit logprobs and System 2 from the model's
 * ratings, but where the distribution lands on the level line is computed
 * here, once, in code.
 *
 * @param probabilities - One probability per level, level i weighted i,
 *        in level order.
 * @returns The probability-weighted mean of the level numbers.
 * @example
 * ```ts
 * expectedValue([0, 0.5, 0.5]);
 * // → 1.5 — between levels 1 and 2
 * ```
 */
export function expectedValue(probabilities: readonly number[]): number {
  return probabilities.reduce((sum, p, i) => sum + i * p, 0);
}
