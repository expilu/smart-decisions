import type { TopLogprob } from './top-logprob.js';

/**
 * Log probability information for one generated content token.
 *
 * @example
 * ```ts
 * const info: ChatCompletionTokenLogprob = {
 *   token: 'A',
 *   logprob: -0.5,
 *   top_logprobs: [
 *     { token: 'A', logprob: -0.5 },
 *     { token: 'B', logprob: -1.2 },
 *   ],
 * };
 * ```
 */
export interface ChatCompletionTokenLogprob {
  /** The generated token */
  token: string;
  /** Natural log of the probability the model assigned to this token */
  logprob: number;
  /** The most likely tokens at this position; may be fewer than requested */
  top_logprobs?: TopLogprob[];
}
