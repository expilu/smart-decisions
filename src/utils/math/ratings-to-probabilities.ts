/**
 * Normalizes ratings into a probability distribution over the candidates.
 *
 * Ratings are the model's relative fitness scores (each an integer 0..10);
 * the probability of a candidate is its share of the ratings mass. This is
 * the same readout for every System 2 question type: choice maps it onto
 * option names, score onto level numbers, and noul takes a two-candidate
 * ratio from it.
 *
 * A candidate rated 0 contributes nothing — unlike System 1, where an unseen
 * symbol means "no signal", a deliberate 0 is information: the model weighed
 * the candidate and rated it unfit. All-zero ratings are the degenerate case
 * the model rated everything 0; the distribution falls back to uniform (no
 * decision among them rather than a fake one-hot), which also reads
 * confidence 0 and escalates visibly under 'auto' mode.
 *
 * @param ratings - One rating per candidate, in candidate order.
 * @returns One probability per candidate, same order, summing to 1.
 * @throws When a rating is not a finite non-negative number — a miscalibrated
 *         readout must not silently become a distribution.
 * @example
 * ```ts
 * ratingsToProbabilities([8, 2, 0]);
 * // → [0.8, 0.2, 0]
 * ```
 */
export function ratingsToProbabilities(ratings: readonly number[]): number[] {
  for (const r of ratings) {
    if (typeof r !== 'number' || !Number.isFinite(r) || r < 0) {
      throw new Error(
        `internal error: ratings must be finite non-negative numbers, got ${String(r)}`,
      );
    }
  }
  const total = ratings.reduce((sum, r) => sum + r, 0);
  if (total === 0) {
    // Everything rated 0: no decision. Uniform beats a fake verdict, and the
    // entropy-based confidence of a uniform distribution reads 0.
    return ratings.map(() => 1 / ratings.length);
  }
  return ratings.map((r) => r / total);
}
