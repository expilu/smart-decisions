/**
 * The outcome of a score: where the state lands on the level spectrum, how
 * likely every level was and how decisive the placement was.
 *
 * @example
 * ```ts
 * const answer: ScoreAnswer = {
 *   score: 2.43,
 *   probabilities: { '0': 0.0, '1': 0.0, '2': 0.57, '3': 0.43, '4': 0.0 },
 *   confidence: 0.38,
 *   legend: {
 *     '0': 'No rush; whenever there is a spare moment',
 *     '1': 'Within the week is fine',
 *     '2': 'Before the day ends',
 *     '3': 'Within the hour',
 *     '4': 'Right now, drop everything',
 *   },
 * };
 * ```
 */
export interface ScoreAnswer {
  /**
   * Position on the level line, from 0 to the top level number — the
   * probability-weighted mean of the level numbers, so it can fall between two
   * levels. A score of 1.0 can mean all probability on level 1, or half on each
   * of levels 0 and 2; read `probabilities` alongside it.
   */
  score: number;
  /** The probability of each level, keyed by level number as a string. Sums to 1 */
  probabilities: Record<string, number>;
  /** 0..1 — flat distribution → low, single peak → high */
  confidence: number;
  /** Each level number mapped back to its description */
  legend: Record<string, string>;
}
