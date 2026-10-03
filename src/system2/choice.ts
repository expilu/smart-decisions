import type { ChoiceAnswer } from '../types/choice-answer.js';
import type { Question } from '../types/question.js';
import { system2Prompt, system2Ratings } from './system2.js';
import { normalizeEntropy } from '../utils/math/normalize-entropy.js';
import { ratingsToProbabilities } from '../utils/math/ratings-to-probabilities.js';

/**
 * System 2 choice: slow, effortful and deliberate — reasoning applied to
 * reach a considered verdict, from Kahneman's Thinking, Fast and Slow.
 *
 * The model deliberates (thinking mode on or off as the question requests)
 * and answers with a structured ratings object: one integer 0..10 per
 * option, its share of the ratings mass being the option's probability. The
 * shared System 2 engine in `src/system2/system2.ts`, sibling of this file,
 * handles the request schema, the parsing-rejection-retry loop and every
 * engine's structured-output quirks; this function adds what is specific to
 * Choice: the option list rendering, the option bounds and the argmax.
 *
 * All of it flows into the same answer shape System 1 returns — the winning
 * option, the probability distribution over every option and the entropy
 * confidence — so callers can switch modes without changing anything
 * downstream.
 *
 * @param question - The decision to make: options, state, instructions and
 *        the model to query.
 * @returns The winning option (highest rating's share), the probability
 *          distribution over every option (sums to 1), and a 0..1 confidence
 *          based on the distribution's entropy (flat → low, single peak →
 *          high).
 * @throws If there are fewer than 2 options — the lower bound every mode
 *         shares; there is no upper bound here, the ratings schema does not
 *         depend on token indirection the way System 1's letters do.
 * @throws When no structured ratings could be obtained (see `system2Ratings`).
 * @example
 * ```ts
 * const answer = await system2Choice({
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: process.env.API_KEY!,
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: "It is raining and I am at home. I'm bored.",
 *   instructions: 'Give me a good plan to do now',
 *   criteria: { walk: 'Go for a walk', movie: 'Watch a movie' },
 * });
 * console.log(answer.choice); // 'movie'
 * ```
 */
export async function system2Choice(question: Question): Promise<ChoiceAnswer> {
  const entries = Object.entries(question.criteria);
  const names = entries.map(([n]) => n);

  // Fail fast when called directly (without choice()); 2+ options is a
  // decision — a single candidate is a statement, not a choice.
  if (names.length < 2) {
    throw new Error(`choice() supports 2 or more options, got ${names.length}`);
  }

  const prompt = system2Prompt({
    question,
    listLabel: 'Options',
    lines: entries.map(([name, description]) => `${name}: ${description}`),
    keys: names,
  });

  const ratings = await system2Ratings(question, prompt, names);

  // One probability per option, in the criteria's own key order: each rating
  // becomes its share of the ratings mass. `validateRatings` guaranteed every
  // key present, so no nullish slot exists to guard — the validator is the
  // invariant the engine already enforced.
  const probs = ratingsToProbabilities(names.map((n) => ratings[n]!));
  const probabilities: Record<string, number> = {};
  names.forEach((n, i) => (probabilities[n] = probs[i]!));

  // Argmax over the option probabilities → winning option name. On a tie the
  // first option wins, as in System 1: deterministic, in the user's order.
  // `probs` is dense (same construction as `names`), so the index lookup is safe.
  const bestIndex = probs.reduce((b, p, i) => (p > probs[b]! ? i : b), 0);
  const best = names[bestIndex];
  if (best === undefined) {
    // Unreachable: bestIndex always falls within 0..names.length-1. Kept as a
    // loud failure instead of `?? ''` so a broken invariant surfaces as an
    // error.
    throw new Error(`internal error: winning option not found at index ${bestIndex}`);
  }

  return {
    choice: best,
    probabilities: probabilities,
    confidence: normalizeEntropy(Object.values(probabilities)),
  };
}
