import type { ChatCompletionChoice } from './chat-completion-choice.js';

/**
 * A chat completions response, narrowed to the fields this library reads.
 *
 * Response fields we don't consume (ids, usage, timestamps, ...) are passed
 * through untouched at runtime; they are just not typed.
 *
 * @example
 * ```ts
 * const completion: ChatCompletion = {
 *   choices: [
 *     { logprobs: { content: [{ token: 'A', logprob: -0.5, top_logprobs: [] }] } },
 *   ],
 * };
 * ```
 */
export interface ChatCompletion {
  /** The generated choices; the first one is the answer */
  choices: ChatCompletionChoice[];
}
