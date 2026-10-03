import type { ModeQuestion } from './mode-fields.js';

/**
 * Describes what a "yes" and a "no" mean, for when the boundary between them
 * is not obvious from the instructions alone.
 *
 * @example
 * ```ts
 * const criteria: NoulCriteria = {
 *   true: 'Mentions a prior attempt, ticket, or that they have asked before',
 *   false: 'No sign of any previous contact',
 * };
 * ```
 */
export interface NoulCriteria {
  /** What a "yes" (a value near 1) means. */
  true?: string;
  /** What a "no" (a value near 0) means. */
  false?: string;
}

/**
 * The judgment to make: a yes/no question, state, optional criteria and the
 * model to query.
 *
 * A {@linkcode ModeQuestion} with the criteria of the noul. The System 2-only
 * question fields (`thinking`, `autoModeThreshold`) are mode-validity-checked
 * at the type level.
 *
 * @example
 * ```ts
 * const question: NoulQuestion = {
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: 'a-super-secret-api-key',
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: 'I have asked three times now. Can I please just talk to a real person?',
 *   instructions: 'Is the customer asking for a human agent?',
 *   criteria: {
 *     true: 'Explicitly asks for a person, agent or human',
 *     false: 'No sign of wanting a person',
 *   },
 * };
 * ```
 */
export type NoulQuestion = ModeQuestion & {
  /** What a yes and a no mean. Optional: the instructions alone usually answer well */
  criteria?: NoulCriteria;
};
