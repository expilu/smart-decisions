import type { ScoreAnswer } from '../types/score-answer.js';
import type { ScoreQuestion } from '../types/score-question.js';
import { system2Prompt, system2Ratings } from './system2.js';
import { normalizeEntropy } from '../utils/math/normalize-entropy.js';
import { ratingsToProbabilities } from '../utils/math/ratings-to-probabilities.js';
import { expectedValue } from '../utils/math/expected-value.js';

/**
 * System 2 score: slow, effortful and deliberate — reasoning applied to
 * reach a considered rating, from Kahneman's Thinking, Fast and Slow.
 *
 * The model deliberates and answers with a structured ratings object: one
 * integer 0..10 per level, the level numbers weighted by the normalized
 * ratings becoming the position on the spectrum — the score, which can fall
 * between two levels. The distribution-to-position math is shared with
 * System 1 (`expectedValue`): wherever the distribution comes from, where it
 * lands on the line is computed once, in code. The shared System 2 engine in
 * `src/system2/system2.ts`, sibling of this file, handles the request
 * schema, the parsing-rejection-retry loop and the engine quirks; this
 * function adds what is specific to Score: the level rendering, the bounds
 * and the legend.
 *
 * The answer shape is System 1's: position, distribution, confidence, legend.
 *
 * @param question - The rating to make: ordered levels, state, instructions
 *        and the model to query.
 * @returns The position on the level line (probability-weighted mean of the
 *          level numbers), the probability distribution over every level
 *          (sums to 1), a 0..1 confidence based on the distribution's
 *          entropy, and the legend mapping each level number back to its
 *          description.
 * @throws If there are fewer than 2 or more than 10 levels — System 1 keeps
 *         a one-digit-per-level ceiling, and the level numbering (0..n-1)
 *         the score is built on must mean the same thing everywhere.
 * @throws When no structured ratings could be obtained (see `system2Ratings`).
 * @example
 * ```ts
 * const answer = await system2Score({
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: process.env.API_KEY!,
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: 'Can you hop on a quick call before the 3pm? Legal is asking about the rider we flagged this morning.',
 *   instructions: 'How fast does this need a reply?',
 *   criteria: ['Whenever is fine', 'Before the day ends', 'Right now, drop everything'],
 * });
 * console.log(answer.score); // e.g. 1.43
 * ```
 */
export async function system2Score(question: ScoreQuestion): Promise<ScoreAnswer> {
  const levels = question.criteria;

  // Same bounds as System 1: the level numbering is the readout, and it must
  // stay comparable between modes. Fail fast here too, so calling
  // system2Score() directly (without score()) is safe.
  if (levels.length < 2 || levels.length > 10) {
    throw new Error(`score() supports 2..10 levels, got ${levels.length}`);
  }

  const prompt = system2Prompt({
    question,
    listLabel: 'Levels',
    // "i: description", level i numbering from 0. The order in the array is
    // the whole spectrum the score is positioned on.
    lines: levels.map((description, i) => `${i}: ${description}`),
    keys: levels.map((_, i) => `${i}`),
  });

  const ratings = await system2Ratings(
    question,
    prompt,
    levels.map((_, i) => `${i}`),
  );

  // Per-level probabilities in the level order: each rating becomes its share
  // of the ratings mass. The validator guaranteed every level key is present,
  // so there is no nullish slot to guard. The position on the line — each
  // level number times its probability — is computed once, in code, shared
  // with System 1 (`expectedValue`).
  const probs = ratingsToProbabilities(levels.map((_, i) => ratings[`${i}`]!));
  const probabilities: Record<string, number> = {};
  const legend: Record<string, string> = {};
  levels.forEach((description, i) => {
    const key = `${i}`;
    probabilities[key] = probs[i]!;
    legend[key] = description;
  });

  return {
    score: expectedValue(probs),
    probabilities: probabilities,
    confidence: normalizeEntropy(Object.values(probabilities)),
    legend: legend,
  };
}
