/**
 * Normalized Shannon entropy complement.
 *
 * Measures how "decided" a probability distribution is: a flat (uniform) distribution
 * maps to 0 (maximum spread, no signal), a fully peaked distribution (all mass on one
 * option) maps to 1. Uses natural log, so any non-negative probability vector works.
 *
 * @param probs - Probability values of the distribution (e.g. one per choice option).
 * @returns 0..1 confidence; `1 - H` where `H = -Σ p·ln(p) / ln(n)` and `n = probs.length`.
 * @example
 * ```ts
 * normalizeEntropy([0.5, 0.5]); // 0    — coin flip, no confidence
 * normalizeEntropy([1, 0]);     // 1    — fully decided
 * normalizeEntropy([0.9, 0.1]); // ≈0.56 — a lean
 * ```
 */
export function normalizeEntropy(probs: number[]): number {
  // -Σ p·ln(p), skipping p === 0 entries since their contribution is 0 (lim p·ln(p) = 0)
  // and ln(0) would otherwise be -Infinity.
  const h = -probs.reduce((s, p) => (p > 0 ? s + p * Math.log(p) : s), 0) / Math.log(probs.length);
  return 1 - h;
}
