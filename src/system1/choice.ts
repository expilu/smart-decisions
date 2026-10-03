import type { ChoiceAnswer } from '../types/choice-answer.js';
import type { Question } from '../types/question.js';
import { system1Prompt, system1SymbolProbabilities } from './system1.js';
import { normalizeEntropy } from '../utils/math/normalize-entropy.js';

// The letters of the alphabet.
// These will be used to map choices criterias to one letter so we can later check those token logits.
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * System 1 answer: fast, automatic and instinctive — the immediate "gut" reply
 * from Kahneman's Thinking, Fast and Slow.
 *
 * Asks the model a single question and reads the logprobs of the answer's first
 * generated token, so the whole decision costs one forward pass and one token:
 * an option is chosen only if its letter has the highest probability among the
 * candidate letter tokens. The logprobs-to-distribution work is shared with the
 * other System 1 questions in `src/system1/system1.ts`, a sibling of this file;
 * this function adds what
 * is specific to Choice: the letter mapping, the option bounds and the argmax.
 *
 * @param question - The decision to make: options, state, instructions and the model to query.
 * @returns The winning option (highest letter probability), the probability
 *          distribution over every option (sums to 1), and a 0..1 confidence
 *          based on the distribution's entropy (flat → low, single peak → high).
 * @throws If there are fewer than 2 or more than 26 options (one per letter).
 * @example
 * ```ts
 * const answer = await system1Choice({
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
export async function system1Choice(question: Question): Promise<ChoiceAnswer> {
  const entries = Object.entries(question.criteria);
  const names = entries.map(([n]) => n);

  // Min and max supported. The number of alphabet letters whose token logits will be checked.
  // Fail fast here too, so calling system1Choice() directly (without choice()) is safe.
  if (names.length < 2 || names.length > 26) {
    throw new Error(`choice() supports 2..26 options, got ${names.length}`);
  }

  // Symbols visible to the model: one letter per option, rendered in the prompt
  // and expected back as the single generated token.
  const symbols = LETTERS.slice(0, names.length);

  // Render each option as "A: name — description" so the model answers with a
  // single letter instead of the option name (which may not even be a single token).
  const lines = entries.map(([n, description], i) => `${LETTERS[i]}: ${n} — ${description}`);

  const prompt = system1Prompt({
    question,
    listLabel: 'Options',
    lines,
    answerTerm: 'letter',
    symbols,
  });

  // Choice letters fold every variant of the same letter into one bucket: case
  // and leading-space tokens all canonicalize to the bare uppercase letter.
  // Tokens that aren't option letters can't canonicalize into a candidate
  // either way, so nothing extra is rejected here.
  const probs = await system1SymbolProbabilities(question, prompt, symbols, (token) =>
    token.trim().toUpperCase(),
  );

  // Per-option probabilities in the criteria's own key order. `?? 0` keeps a
  // nullish slot from NaN-poisoning the distribution when a JS caller has
  // broken the invariant that the core returns numbers.
  const probabilities: Record<string, number> = {};
  names.forEach((n, i) => (probabilities[n] = probs[i] ?? 0));

  // Argmax over the letter probabilities → winning option name.
  const bestIndex = probs.reduce((b, p, i) => (p > (probs[b] ?? 0) ? i : b), 0);
  const best = names[bestIndex];
  if (best === undefined) {
    // Unreachable: bestIndex always falls within 0..names.length-1. Kept as a loud
    // failure instead of `?? ''` so a broken invariant surfaces as an error.
    throw new Error(`internal error: winning option not found at index ${bestIndex}`);
  }

  const confidence = normalizeEntropy(Object.values(probabilities));

  return {
    choice: best,
    probabilities: probabilities,
    confidence: confidence,
  };
}
