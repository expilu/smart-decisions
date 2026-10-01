/**
 * The outcome of a noul: the probability that the answer is "yes", from 0
 * (definitely no) to 1 (definitely yes).
 *
 * There is no `confidence` field, unlike `ChoiceAnswer` and `ScoreAnswer`: the
 * distribution has only two outcomes, yes and no, so the single `noul` value
 * describes it completely — a value near 0.5 *is* the low-confidence signal.
 * Threshold it in your code, and treat values near 0.5 as a third path
 * (human review) rather than as data.
 *
 * @example
 * ```ts
 * const answer: NoulAnswer = {
 *   noul: 0.97, // strong yes
 * };
 * ```
 */
export interface NoulAnswer {
  /** The yes/no answer on a scale from 0 (no) to 1 (yes). 0.5 = the model gives both similar probability */
  noul: number;
}
