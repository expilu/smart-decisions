import { generateText } from '../utils/llms/generate-text.js';
import { normalizeEntropy } from '../utils/math/normalize-entropy.js';
import type { ChoiceAnswer } from '../types/choice-answer.js';
import type { Question } from '../types/question.js';

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
 * candidate letter tokens. No deliberation, no chain-of-thought, no structured
 * output — that's System 2's job.
 *
 * @param question - The decision to make: options, state, instructions and provider settings.
 * @returns The winning option (highest letter probability), the probability
 *          distribution over every option (sums to 1), and a 0..1 confidence
 *          based on the distribution's entropy (flat → low, single peak → high).
 * @throws If there are fewer than 2 or more than 26 options (one per letter).
 * @example
 * ```ts
 * const answer = await system1Choice({
 *   apiBaseUrl: 'http://localhost:8000/v1',
 *   apiKey: process.env.API_KEY!,
 *   model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
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

  // Render each option as "A: name — description" so the model answers with a
  // single letter instead of the option name (which may not even be a single token).
  const optionLines = entries
    .map(([n, description], i) => `${LETTERS[i]}: ${n} — ${description}`)
    .join('\n');

  const prompt =
    `${question.state}\n\n` +
    `${question.instructions}\n\n` +
    `Options:\n${optionLines}\n\n` +
    `Answer with exactly one letter (${LETTERS.slice(0, names.length).join(', ')}). ` +
    `Reply with that single letter and nothing else.`;

  // The whole decision is one forward pass generating one token. Each param below
  // nudges the model towards emitting just the chosen option's letter.
  // TODO: probably better to move instructions to system prompt for KV cache reuse
  const res = await generateText(
    { apiBaseUrl: question.apiBaseUrl, apiKey: question.apiKey },
    {
      model: question.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1, // the answer is a single letter
      temperature: 0, // greedy: always the most likely letter
      logprobs: true,
      top_logprobs: 50, // llama.cpp server max; margin so every declared letter (and its token variants) lands in the report
      chat_template_kwargs: { enable_thinking: false },
    },
    { maxRetries: question.maxRetries, timeoutMs: question.timeoutMs },
  );

  // The first generated token is the answer letter; its candidate tokens carry
  // the logprobs we turn into the option distribution. Missing logprobs means we
  // have no signal at all — fail loudly rather than return a made-up uniform answer.
  const tops = res.choices[0]?.logprobs?.content?.[0]?.top_logprobs;
  if (!tops || tops.length === 0) {
    throw new Error(
      'system1 requires logprobs, but the provider response has none — check that the API/base URL supports logprobs',
    );
  }

  // Group the candidates by their letter, keeping the highest probability per letter.
  // The same letter can appear as several token variants (case, leading space, BOS...).
  // TODO: check if keeping the highest one is the best option
  const letterProbability = new Map<string, number>();
  for (const t of tops) {
    const letter = t.token.trim().toUpperCase();
    const p = Math.exp(t.logprob);
    if (p > (letterProbability.get(letter) ?? 0)) {
      letterProbability.set(letter, p);
    }
  }

  // Map each option to its letter's probability (0 if that letter never showed up).
  const probs = names.map((_, i) => letterProbability.get(LETTERS[i]!) ?? 0);

  // Normalize to a distribution that sums to 1.
  const probabilities: Record<string, number> = {};
  const z = probs.reduce((s, p) => s + p, 0);
  if (z > 0) {
    names.forEach((n, i) => (probabilities[n] = (probs[i] ?? 0) / z));
  } else {
    // No candidate letter made it into the top logprobs at all: no signal. Fall back to
    // a uniform distribution rather than an all-zero one (the old `|| 1` guard silently
    // produced probabilities that summed to 0 with confidence 1 — arguably worse than useless).
    names.forEach((n) => (probabilities[n] = 1 / names.length));
  }

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
