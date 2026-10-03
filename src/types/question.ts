import type { ModeQuestion } from './mode-fields.js';

/**
 * The decision to make: options, state, instructions, mode and the model to query.
 *
 * A {@linkcode ModeQuestion} with the criteria of the choice: the fixed set of
 * options, no order between them. The System 2-only question fields
 * (`thinking`, `autoModeThreshold`) are mode-validity-checked at the type
 * level — a `thinking` set with `mode: 'system1'` does not compile.
 *
 * @example
 * ```ts
 * const question: Question = {
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: 'a-super-secret-api-key',
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: "It is raining and I am at home. I'm bored.",
 *   instructions: 'Give me a good plan to do now',
 *   criteria: { walk: 'Go for a walk', movie: 'Watch a movie' },
 * };
 * ```
 */
export type Question = ModeQuestion & {
  /** The options for the answer. Keys are option names and values are descriptions of the option. i.e. `{ walk: 'Go for a walk', movie: 'Watch a movie' }` */
  criteria: Record<string, string>;
};
