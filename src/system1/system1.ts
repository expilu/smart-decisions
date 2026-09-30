import type { BaseQuestion } from '../types/base-question.js';
import { generateText } from '../utils/llms/generate-text.js';
import { applyExtraBody } from '../utils/llms/apply-extra-body.js';

/**
 * The one-token logprobs trick, shared by every System 1 answer type
 * (`system1Choice` today, `system1Score` next). The LLM always computes a
 * probability distribution over all possible tokens before it answers; these
 * helpers make the answer itself exactly one candidate symbol — a letter or a
 * digit — and read the logprobs of that single generated token, so a whole
 * decision costs one forward pass and one token. No deliberation, no
 * chain-of-thought, no structured output — that's System 2's job.
 
 */

/**
 * Renders the System 1 prompt: the state, the instructions, the candidate list
 * and a closing instruction that pins the answer to a single symbol, so the
 * generated token is short, deterministic and cheap.
 *
 * The list is passed pre-rendered (each primitive labels its entries its own
 * way: `A: name — description` for Choice, `0: description` for Score); this
 * function only assembles the shared envelope. Constraint: `lines` must be
 * rendered against `symbols` in the same order, so line i describes symbol i.
 *
 * @param options - The prompt ingredients:
 *        `question` — the state and instructions to evaluate (the `BaseQuestion`
 *        fields every question type carries);
 *        `listLabel` — the heading of the rendered list, i.e. `'Options'` or
 *        `'Levels'`;
 *        `lines` — the already-rendered candidate lines, one per symbol;
 *        `answerTerm` — what the answer consists of, i.e. `'letter'` or
 *        `'digit'` (used twice in the closing instruction);
 *        `symbols` — the acceptable candidate symbols, rendered comma-separated.
 * @returns The full user-message prompt.
 * @example
 * ```ts
 * const prompt = system1Prompt({
 *   question: { state: '...', instructions: 'Which team?' },
 *   listLabel: 'Options',
 *   lines: ['A: returns — Exchanges', 'B: shipping — Delays'],
 *   answerTerm: 'letter',
 *   symbols: ['A', 'B'],
 * });
 * ```
 */
export function system1Prompt(options: {
  question: Pick<BaseQuestion, 'state' | 'instructions'>;
  listLabel: string;
  lines: readonly string[];
  answerTerm: string;
  symbols: readonly string[];
}): string {
  const { question, listLabel, lines, answerTerm, symbols } = options;
  return (
    `${question.state}\n\n` +
    `${question.instructions}\n\n` +
    `${listLabel}:\n${lines.join('\n')}\n\n` +
    `Answer with exactly one ${answerTerm} (${symbols.join(', ')}). ` +
    `Reply with that single ${answerTerm} and nothing else.`
  );
}

/**
 * Asks the model one prompt and turns the logprobs of its single generated
 * token into a probability distribution aligned to `symbols`.
 *
 * The request is tuned to make the answer itself exactly one symbol
 * (deterministic and cheap):
 * - `max_tokens: 1` — the answer is a single token, one forward pass of the model
 * - `temperature: 0` — greedy: always the most likely symbol
 * - `top_logprobs: 20` — the highest portable window: OpenAI and OpenRouter cap
 *   it at 20, and vLLM's server default --max-logprobs is also 20 (llama.cpp
 *   accepts up to 50), so 20 is safe everywhere logprobs exist; realistic
 *   symbol counts fit, and symbols falling outside the window just contribute 0
 * - thinking-reasoning disabled — avoid wasting this one token on a think tag
 *
 * The generated token itself is irrelevant and gets discarded. What matters is
 * the logits: every reported candidate whose canonical form matches a symbol
 * contributes. For each symbol the highest-probability variant wins (the same
 * symbol can appear as several token variants — case, leading space, BOS...),
 * the symbol probabilities are normalized to sum 1, and if no candidate symbol
 * shows up at all the result is a uniform distribution (no signal, rather than
 * an all-zero one).
 *
 * @param question - The transport fields of the question being answered:
 *        `model` to query and the optional `maxRetries`/`timeoutMs` overrides.
 *        Extra question fields (state, instructions, the type-specific answer
 *        shape) are accepted structurally and ignored — the caller owns them.
 * @param prompt - The full user-message prompt, typically built with
 *        `system1Prompt`.
 * @param symbols - The candidate symbols in the order the distribution should
 *        come back, i.e. `['A', 'B', 'C']` or `['0', '1', '2']`.
 * @param canonicalize - Maps one reported token to the symbol it is a variant
 *        of, or `null` when it must be ignored (not a candidate at all). This
 *        is the only per-primitive seam: Choice folds case and spacing variants
 *        of a letter into one bucket; Score matches a single digit exactly and
 *        rejects everything else.
 * @returns One probability per symbol, in `symbols` order, summing to 1. When
 *          no symbol is found, all entries are `1 / symbols.length`.
 * @throws If the provider response carries no logprobs at all — there is no
 *         signal to read, and a made-up uniform answer would silently lie.
 * @example
 * ```ts
 * const probs = await system1SymbolProbabilities(
 *   question,
 *   prompt,
 *   ['A', 'B'],
 *   (token) => token.trim().toUpperCase(),
 * );
 * // → [0.7, 0.3]
 * ```
 */
export async function system1SymbolProbabilities(
  question: Pick<BaseQuestion, 'model' | 'maxRetries' | 'timeoutMs'>,
  prompt: string,
  symbols: readonly string[],
  canonicalize: (token: string) => string | null,
): Promise<number[]> {
  // The whole decision is one forward pass generating one token. Each param below
  // nudges the model towards emitting just the chosen symbol.
  // TODO: probably better to move instructions to system prompt for KV cache reuse
  const res = await generateText(
    { apiBaseUrl: question.model.apiBaseUrl, apiKey: question.model.apiKey },
    applyExtraBody(
      {
        model: question.model.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1, // the answer is a single token, one pass of the model
        temperature: 0, // greedy: always the most likely symbol
        logprobs: true,
        // 20 is the highest portable window: OpenAI and OpenRouter cap top_logprobs
        // at 20, and vLLM's server default --max-logprobs is also 20. llama.cpp
        // accepts up to 50, so 20 is safe everywhere logprobs exist. The margin is
        // enough for realistic symbol counts; symbols falling outside the window
        // just contribute 0 to their symbol's probability.
        top_logprobs: 20,
        chat_template_kwargs: { enable_thinking: false },
      },
      question.model.extraBody,
    ),
    { maxRetries: question.maxRetries, timeoutMs: question.timeoutMs },
  );

  // The first generated token is the answer symbol; its candidate tokens carry
  // the logprobs we turn into the symbol distribution. Missing logprobs means we
  // have no signal at all — fail loudly rather than return a made-up uniform answer.
  const tops = res.choices[0]?.logprobs?.content?.[0]?.top_logprobs;
  if (!tops || tops.length === 0) {
    throw new Error(
      'system1 requires logprobs, but the provider response has none — check that the API/base URL supports logprobs',
    );
  }

  // Group the candidates by their canonical symbol, keeping the highest
  // probability per symbol. The same symbol can appear as several token
  // variants (case, leading space, BOS...), and whatever doesn't canonicalize
  // to a symbol is skipped.
  // TODO: check if keeping the highest one is the best option
  const symbolProbability = new Map<string, number>();
  for (const t of tops) {
    // A non-conforming server can send malformed entries (missing or null token);
    // skip them instead of crashing mid-read — the remaining candidates still
    // carry the decision.
    if (typeof t?.token !== 'string') {
      continue;
    }
    const symbol = canonicalize(t.token);
    if (symbol === null) {
      continue;
    }
    const p = Math.exp(t.logprob);
    if (p > (symbolProbability.get(symbol) ?? 0)) {
      symbolProbability.set(symbol, p);
    }
  }

  // Map each symbol to its canonical probability (0 if it never showed up), then
  // normalize to a distribution that sums to 1.
  const probs = symbols.map((s) => symbolProbability.get(s) ?? 0);
  const z = probs.reduce((sum, p) => sum + p, 0);
  if (z > 0) {
    return probs.map((p) => p / z);
  }
  // No candidate symbol made it into the top logprobs at all: no signal. Fall back to
  // a uniform distribution rather than an all-zero one (which would produce
  // probabilities that sum to 0 with confidence 1 — arguably worse than useless).
  return symbols.map(() => 1 / symbols.length);
}
