import type { ScoreAnswer } from '../types/score-answer.js';
import type { ScoreQuestion } from '../types/score-question.js';
import { routeMode } from '../utils/mode/route-mode.js';
import { system1Score } from '../system1/score.js';
import { system2Score } from '../system2/score.js';

/**
 * Rates where the given state lands on a spectrum you describe in levels.
 *
 * The question is routed to the selected mode, following Kahneman's dual-process
 * theory of the mind (Thinking, Fast and Slow): System 1 is fast, automatic and
 * instinctive — the immediate answer that comes to mind, costing one forward
 * pass and one token; System 2 is slow, effortful and deliberate — reasoning
 * applied to reach a considered verdict, slower and more costly.
 *
 * The answer is a position on the level line, which can fall between two
 * levels: the score is each level number weighted by its probability,
 * together with the probability of every level and a confidence. Use it when
 * the answer is a position on a spectrum — how fast a reply is needed, how
 * warm a lead is, how close a draft is to done; if it's one of a fixed set
 * with no order between them, use `choice()`.
 *
 * @param question - The rating to make: ordered levels, state, instructions and the model to query.
 * @returns The position on the level line and the probability distribution over
 *          every level (sums to 1), plus a 0..1 confidence (flat distribution →
 *          low, single peak → high) and the legend mapping each level number
 *          back to its description.
 * @throws If `criteria` is not an array, has fewer than 2 or more than 10
 *         levels, or a level is not a string. (In System 1 mode, the bounds are
 *         also enforced inside `system1Score`.)
 * @throws In System 2 mode (not implemented yet).
 * @throws If `mode` is not a known `Mode` value.
 * @example
 * ```ts
 * const answer = await score({
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: process.env.API_KEY!,
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
 * });
 * console.log(answer.score); // e.g. 2.43 — between levels 2 and 3, leaning to 2
 * ```
 */
export async function score(question: ScoreQuestion): Promise<ScoreAnswer> {
  // Guard against non-array values from JS callers, since TypeScript types don't
  // apply at runtime: Object-style duck values could slip past the bounds check.
  if (!Array.isArray(question.criteria)) {
    throw new Error('criteria must be an array of level descriptions');
  }

  const levels = question.criteria;

  // No sense on scoring on a single level, and one digit per level caps it at 10.
  if (levels.length < 2 || levels.length > 10) {
    throw new Error(`score() supports 2..10 levels, got ${levels.length}`);
  }

  // Guard against non-string values from JS callers, since TypeScript types don't apply at runtime.
  levels.forEach((level, i) => {
    if (typeof level !== 'string') {
      throw new Error(`criteria[${i}] must be a string, got ${typeof level}`);
    }
  });

  // Route through the shared mode router.
  // Default to System 1.
  return routeMode(question, {
    system1: () => system1Score(question),
    system2: () => system2Score(question),
    confidence: (answer) => answer.confidence,
  });
}
