import type { Model } from './model.js';

/**
 * The fields every question type shares, whatever mode answers it.
 *
 * Concretely: what evaluates the question (the `model` and its transport
 * settings), what it evaluates (`state`) and what it is asked
 * (`instructions`). The `mode`-dependent fields live in
 * {@linkcode ModeQuestion} (`src/types/mode-fields.ts`) — the mode-partitioned
 * union every question type is built from — and the per-type answer shape —
 * options for `choice()`, ordered levels for `score()`, ... — lives in the
 * extending type.
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
  /**
   * Log internals to stderr as the question is answered — the prompt, the wire
   * request, the raw response, retry and validation-feedback reasons and, in
   * System 2 mode, the model's reasoning. Global: available to System 1 and
   * System 2 alike. Entries go out in dark gray when the stream supports ANSI
   * color. Never logs credentials or URLs' query parameters. Defaults to false
   */
  debug?: boolean;
  /** The state to evaluate */
  // TODO: allow passing objects
  state: string;
  /** The question to answer */
  instructions: string;
}
