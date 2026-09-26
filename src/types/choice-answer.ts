/**
 * The outcome of a decision: which option won, how likely every option was and
 * how decisive the win was.
 *
 * @example
 * ```ts
 * const answer: ChoiceAnswer = {
 *   choice: 'movie',
 *   probabilities: { walk: 0.00081, movie: 0.99913, beach: 0.00006 },
 *   confidence: 0.9935,
 * };
 * ```
 */
export interface ChoiceAnswer {
  /** Option name with the highest probability */
  choice: string;
  /** Full distribution over every option, sums to 1 */
  probabilities: Record<string, number>;
  /** 0..1 — flat distribution → low, single peak → high */
  confidence: number;
}
