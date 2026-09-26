export interface ChoiceAnswer {
  /** Option name with the highest probability */
  choice: string;
  /** Full distribution over every option, sums to 1 */
  probabilities: Record<string, number>;
  /** 0..1 — flat distribution → low, single peak → high */
  confidence: number;
}
