import type { ChoiceMode } from './choice-mode.js';

/**
 * The decision to make: options, state, instructions and provider settings.
 *
 * @example
 * ```ts
 * const question: Question = {
 *   apiBaseUrl: 'http://localhost:8000/v1',
 *   apiKey: 'a-super-secret-api-key',
 *   model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   state: "It is raining and I am at home. I'm bored.",
 *   instructions: 'Give me a good plan to do now',
 *   criteria: { walk: 'Go for a walk', movie: 'Watch a movie' },
 * };
 * ```
 */
export interface Question {
  /** Base url of an OpenAI compatible v1 API, i.e. `'http://localhost:8000/v1'` */
  apiBaseUrl: string;
  /** The API key as required or not by your provider */
  apiKey: string;
  /** The model identifier as required by your API provider. i.e. `'/models/Qwen3.5-4B-Q4_K_M.gguf'` for llama.cpp */
  model: string;
  /** Maximum number of retries after a failed attempt (network errors, 408/409/429/5xx). Defaults to 2 */
  maxRetries?: number;
  /** Per-attempt timeout in milliseconds. Defaults to 600000 */
  timeoutMs?: number;
  /** Choose between System 1 or System 2 mode. Defaults to `'system1'` */
  mode?: ChoiceMode;
  /** The state to evaluate */
  // TODO: allow passing objects
  state: string;
  /** The question to answer */
  instructions: string;
  /** The options for the answer. Keys are option names and values are descriptions of the option. i.e. `{ walk: 'Go for a walk', movie: 'Watch a movie' }` */
  criteria: Record<string, string>;
}
