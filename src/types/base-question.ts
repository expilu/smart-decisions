import type { Mode } from './mode.js';
import type { Model } from './model.js';

/**
 * The fields every question type shares, whatever it asks.
 *
 * Concretely: what evaluates the question (the `model` and its transport
 * settings), what it evaluates (`state`) and what it is asked
 * (`instructions`). The per-type answer shape — options for `choice()`,
 * ordered levels for `score()`, ... — lives in the extending interface.
 *
 * @example
 * ```ts
 * const base: BaseQuestion = {
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: 'a-super-secret-api-key',
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: "It is raining and I am at home. I'm bored.",
 *   instructions: 'Give me a good plan to do now',
 * };
 * ```
 */
export interface BaseQuestion {
  /** The model to use and the OpenAI-compatible API serving it (endpoint, credentials, model id and extra request settings) */
  model: Model;
  /** Maximum number of retries after a failed attempt (network errors, 408/409/429/5xx). Defaults to 2 */
  maxRetries?: number;
  /** Per-attempt timeout in milliseconds. Defaults to 600000 */
  timeoutMs?: number;
  /** Choose between System 1 or System 2 mode. Defaults to `'system1'` */
  mode?: Mode;
  /** The state to evaluate */
  // TODO: allow passing objects
  state: string;
  /** The question to answer */
  instructions: string;
}
