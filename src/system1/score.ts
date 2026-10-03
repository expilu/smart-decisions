import type { ScoreAnswer } from '../types/score-answer.js';
import type { ScoreQuestion } from '../types/score-question.js';
import { system1Prompt, system1SymbolProbabilities } from './system1.js';
import { normalizeEntropy } from '../utils/math/normalize-entropy.js';

/**
 * System 1 score: fast, automatic and instinctive — the immediate "gut" rating
 * from Kahneman's Thinking, Fast and Slow.
 *
 * Asks the model a single question and reads the logprobs of the answer's first
 * generated token: every level is rendered as a digit, the model answers with
 * exactly one digit, and the digit probabilities become the level distribution
 * through the shared System 1 engine in `src/system1/system1.ts`, a sibling of
 * this file. This function
 * adds what is specific to Score: the digit mapping, the level bounds and the
 * expected value that turns the distribution into a position on the spectrum.
 *
 * The model never sees the level numbers as what they are — the answer tokens
 * are only how each level is addressable.
 * The position itself is computed here, in code: number-wise the score is each
 * level number multiplied by its probability, added up, so it can fall between
 * two levels.
 *
 * @param question - The rating to make: ordered levels, state, instructions and the model to query.
 * @returns The position on the level line (probability-weighted mean of the
 *          level numbers), the probability distribution over every level (sums
 *          to 1), a 0..1 confidence based on the distribution's entropy, and
 *          the legend mapping each level number back to its description.
 * @throws If there are fewer than 2 or more than 10 levels.
 * @example
 * ```ts
 * const answer = await system1Score({
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
export async function system1Score(question: ScoreQuestion): Promise<ScoreAnswer> {
  const levels = question.criteria;

  // Min and max supported: one digit per level, 0..9 (mirrors the reference
  // implementations' cap of 10 levels). Fail fast here too, so calling
  // system1Score() directly (without score()) is safe.
  if (levels.length < 2 || levels.length > 10) {
    throw new Error(`score() supports 2..10 levels, got ${levels.length}`);
  }

  // Symbols visible to the model: one digit per level — level i is rendered as
  // `i: description`, and its symbol is exactly that digit. The model answers
  // with one of these; the ordering used for the score is this very numbering.
  const symbols = levels.map((_, i) => `${i}`);

  // Render each level as "i: description". The description is the only thing
  // the level is judged on, so order in the array is the whole numbering.
  const lines = levels.map((description, i) => `${i}: ${description}`);

  const prompt = system1Prompt({
    question,
    listLabel: 'Levels',
    lines,
    answerTerm: 'digit',
    symbols,
  });

  // Digits fold every spacing variant (" 3") of the same level digit into one
  // bucket, and reject anything that isn't an exact single digit ("10", "1.",
  // "three") — a non-level token must contribute nothing rather than blur a
  // neighboring level's probability.
  const digitSet = new Set(symbols);
  const probs = await system1SymbolProbabilities(question, prompt, symbols, (token) => {
    const digit = token.trim();
    return digitSet.has(digit) ? digit : null;
  });

  // Per-level probabilities, legend and the score in one pass over the aligned
  // distribution. The score is the position on the level line: each level
  // number weighted by its probability. The distribution comes back aligned to
  // `levels` (one probability per level), so `levels[i]` can never be missing
  // for a well-returned array.
  const probabilities: Record<string, number> = {};
  const legend: Record<string, string> = {};
  let score = 0;
  probs.forEach((p, i) => {
    const key = `${i}`;
    probabilities[key] = p;
    legend[key] = levels[i]!;
    score += i * p;
  });

  const confidence = normalizeEntropy(Object.values(probabilities));

  return {
    score: score,
    probabilities: probabilities,
    confidence: confidence,
    legend: legend,
  };
}
