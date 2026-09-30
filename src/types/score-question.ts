import type { BaseQuestion } from './base-question.js';

/**
 * The rating to make: ordered levels, state, instructions, mode and the model to query.
 *
 * @example
 * ```ts
 * const question: ScoreQuestion = {
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: 'a-super-secret-api-key',
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: 'Can you hop on a quick call before the 3pm? Legal is asking about the rider we flagged this morning.',
 *   instructions: 'How fast does this need a reply?',
 *   criteria: [
 *     'No rush; whenever there is a spare moment',
 *     'Within the week is fine',
 *     'Before the day ends',
 *     'Within the hour',
 *     'Right now, drop everything',
 *   ],
 * };
 * ```
 */
export interface ScoreQuestion extends BaseQuestion {
  /**
   * The ordered level descriptions, from the low end of the scale to the high
   * end. A level's number is its position in the array, starting at 0; 2..10
   * levels are supported. Describe situations, not degrees: each level is
   * judged on its own against the state, so "worse than the previous level"
   * means nothing to it. i.e. `['Whenever is fine', 'Before the day ends',
   * 'Right now, drop everything']`
   */
  criteria: string[];
}
