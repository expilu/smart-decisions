import type { ChatCompletionTokenLogprob } from './chat-completion-token-logprob.js';

/**
 * One completion alternative as returned by the API.
 *
 * @example
 * ```ts
 * const choice: ChatCompletionChoice = {
 *   logprobs: {
 *     content: [{ token: 'A', logprob: -0.5, top_logprobs: [{ token: 'A', logprob: -0.5 }] }],
 *   },
 * };
 * ```
 */
export interface ChatCompletionChoice {
  /** Log probability information for the generated content, when requested */
  logprobs?: { content?: ChatCompletionTokenLogprob[] | null } | null;
}
