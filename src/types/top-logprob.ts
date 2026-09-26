/**
 * A candidate token and the log probability the model assigned to it at a
 * generation position.
 *
 * @example
 * ```ts
 * const candidate: TopLogprob = { token: 'A', logprob: -0.5 };
 * ```
 */
export interface TopLogprob {
  /** The candidate token */
  token: string;
  /** Natural log of the token probability */
  logprob: number;
}
