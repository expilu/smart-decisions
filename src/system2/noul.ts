import type { NoulAnswer } from '../types/noul-answer.js';
import type { NoulQuestion } from '../types/noul-question.js';
import { system2Prompt, system2Ratings } from './system2.js';
import { ratingsToProbabilities } from '../utils/math/ratings-to-probabilities.js';

/**
 * System 2 noul: slow, effortful and deliberate — reasoning applied to reach
 * a considered yes/no verdict, from Kahneman's Thinking, Fast and Slow.
 *
 * The model deliberates and answers with a structured ratings object holding
 * two keys — `true` and `false`, the judged proposition's two readings — and
 * the "yes" probability is the true rating's share of the two. The shared
 * System 2 engine in `src/system2/system2.ts`, sibling of this file, handles
 * the request schema, the parsing-rejection-retry loop and the engine
 * quirks; this function adds what is specific to Noul: the two-option
 * rendering (with the optional yes/no descriptions) and the ratio.
 *
 * Like System 1's noul there is no separate confidence: with two outcomes
 * the yes probability describes the whole judgment — near 0.5 is the
 * "no clear read" signal itself, and under 'auto' mode that same near-0.5
 * value is what would trigger escalation to a more deliberate pass.
 *
 * @param question - The judgment to make: a yes/no question, state, optional
 *        criteria and the model to query.
 * @returns The yes/no answer on a scale from 0 (no) to 1 (yes), with 0.5 as
 *          the model-less neutral when nothing tips it.
 * @throws When no structured ratings could be obtained (see `system2Ratings`).
 * @example
 * ```ts
 * const answer = await system2Noul({
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: process.env.API_KEY!,
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: 'I have asked three times now. Can I please just talk to a real person?',
 *   instructions: 'Is the customer asking for a human agent?',
 * });
 * console.log(answer.noul); // e.g. 0.97
 * ```
 */
export async function system2Noul(question: NoulQuestion): Promise<NoulAnswer> {
  const prompt = system2Prompt({
    question,
    listLabel: 'Options',
    lines: [
      `true: yes${question.criteria?.true ? ` — ${question.criteria.true}` : ''}`,
      `false: no${question.criteria?.false ? ` — ${question.criteria.false}` : ''}`,
    ],
    keys: ['true', 'false'],
  });

  const ratings = await system2Ratings(question, prompt, ['true', 'false']);

  // The yes probability is the true rating's share of the two-outcome mass.
  // Both rated 0 is the model-less neutral: uniform (see
  // ratingsToProbabilities) reads 0.5, the visible "no clear read" value. The
  // validator guaranteed both keys are present.
  const probs = ratingsToProbabilities([ratings.true!, ratings.false!]);
  return { noul: probs[0]! };
}
