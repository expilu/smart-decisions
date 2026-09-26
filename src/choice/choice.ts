import type { Question } from '../types/question.js';
import type { ChoiceAnswer } from './choice-answer.js';
import { system1Choice } from './system1-choice.js';

/**
 * Decides which option best matches the given state and instructions.
 *
 * The question is routed to the selected mode, following Kahneman's dual-process theory
 * of the mind (Thinking, Fast and Slow): System 1 is fast, automatic and instinctive —
 * the immediate answer that comes to mind; System 2 is slow, effortful and deliberate —
 * reasoning applied to reach a considered verdict. System 1 is also much cheaper in
 * inference (a single forward pass generating a single token), while System 2 is slower
 * and more costly: the LLM may reason and has to generate a full structured response.
 *
 * @param question - The decision to make: options, state, instructions and provider settings.
 * @returns The winning option, the probability distribution over every option (sums to 1),
 *          and a 0..1 confidence (flat distribution → low, single peak → high).
 * @throws If there are fewer than 2 options, or if a criteria value is not a string.
 *         (In System 1 mode, more than 26 options also throw — enforced inside `system1Choice`.)
 * @throws In System 2 mode (not implemented yet).
 * @throws If `mode` is not a known `ChoiceMode` value.
 * @example
 * ```ts
 * const answer = await choice({
 *   apiBaseUrl: 'http://localhost:8000/v1',
 *   apiKey: process.env.API_KEY!,
 *   model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
 *   instructions: 'Which fruit should I buy?',
 *   criteria: {
 *     apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
 *     banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
 *     lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
 *     strawberry: 'Delicious, but moldy within a couple of days',
 *   },
 * });
 * console.log(answer.choice); // 'apple'
 * ```
 */
export async function choice(question: Question): Promise<ChoiceAnswer> {
  const names = Object.keys(question.criteria);

  // No sense on choosing over only one criteria.
  if (names.length < 2) {
    throw new Error(`choice() supports 2, got ${names.length}`);
  }

  // Guard against non-string values from JS callers, since TypeScript types don't apply at runtime.
  for (const n of names) {
    if (typeof question.criteria[n] !== 'string') {
      throw new Error(`criteria["${n}"] must be a string, got ${typeof question.criteria[n]}`);
    }
  }

  // Default to System 1
  const mode = question.mode ?? 'system1';

  // TODO: add an option to choose between reasoning and non-reasoning mode.

  // Route to the selected mode. The final else is unreachable from TypeScript,
  // but keeps JS callers honest with a clear error.
  if (mode === 'system1') {
    return await system1Choice(question);
  } else if (mode === 'system2') {
    throw new Error('Not implemented yet'); // TODO: implement system2.
  } else {
    throw new Error('Unsupported mode');
  }
}
