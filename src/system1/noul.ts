import type { NoulAnswer } from '../types/noul-answer.js';
import type { NoulQuestion } from '../types/noul-question.js';
import { system1Prompt, system1SymbolProbabilities } from './system1.js';

/** Word spellings that count as answering yes */
const YES_WORDS = new Set(['y', 'yes', 'yeah', 'yep']);
/** Word spellings that count as answering no */
const NO_WORDS = new Set(['n', 'no', 'nope', 'nah']);

/**
 * System 1 noul: fast, automatic and instinctive — the immediate "gut" yes/no
 * verdict from Kahneman's Thinking, Fast and Slow.
 *
 * Asks the model a single yes/no question and reads the logprobs of the
 * answer's first generated token: yes and no are rendered as the two symbols
 * `Y` and `N`, the model answers with exactly one letter, and the two letters'
 * probabilities become the judgment through the shared System 1 engine in
 * `src/system1/system1.ts`, a sibling of this file. This function adds what is
 * specific to Noul:
 * two-symbol rendering (with the optional yes/no descriptions) and the ratio
 * that turns the two-symbol distribution into the single probability of "yes".
 *
 * A binary question is the degenerate case of the shared engine: with only two
 * symbols, the normalized distribution already sums to 1, so `P('Y')` is at
 * once the whole answer — there is nothing left to summarize into a separate
 * `confidence`, which is why `NoulAnswer` carries only `noul`.
 *
 * @param question - The judgment to make: a yes/no question, state, optional
 *        criteria and the model to query.
 * @returns The probability that the answer is yes, 0..1. When neither symbol
 *          shows up in the logprob window at all, it is 0.5 — the uniform
 *          no-signal fallback, visibly neutral for a binary judgment.
 * @example
 * ```ts
 * const answer = await system1Noul({
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: process.env.API_KEY!,
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: 'I have asked three times now. Can I please just talk to a real person?',
 *   instructions: 'Is the customer asking for a human agent?',
 * });
 * console.log(answer.noul); // e.g. 0.99
 * ```
 */
export async function system1Noul(question: NoulQuestion): Promise<NoulAnswer> {
  // Symbols visible to the model: yes is rendered as `Y`, no as `N`. The
  // optional criteria descriptions are what each symbol stands for, appended so
  // the model judges them as part of the option it answers with.
  const symbols = ['Y', 'N'] as const;
  const lines = [
    `Y: yes${question.criteria?.true ? ` — ${question.criteria.true}` : ''}`,
    `N: no${question.criteria?.false ? ` — ${question.criteria.false}` : ''}`,
  ];

  const prompt = system1Prompt({
    question,
    listLabel: 'Options',
    lines,
    answerTerm: 'letter',
    symbols,
  });

  // Letters fold the spelling variants of the same answer ('y', ' Y', 'Yes.')
  // into one bucket, and reject anything that isn't a yes or no spelling
  // ('true', 'maybe', '1') — a foreign token must contribute nothing rather
  // than tilt the ratio. The prompt asks for a bare letter, so words are rare;
  // the families cover the realistic ones at no extra cost (a single pass
  // already reported the top-20 window).
  const probs = await system1SymbolProbabilities(question, prompt, symbols, (token) => {
    // First alphabetic run of the token, lowercased: punctuates the variants
    // ('Y.', ' yes,') away without machinery for each spelling.
    const word = token
      .trim()
      .toLowerCase()
      .match(/[a-z]+/)?.[0];
    return word !== undefined && YES_WORDS.has(word)
      ? 'Y'
      : word !== undefined && NO_WORDS.has(word)
        ? 'N'
        : null;
  });

  // The yes/no answer on a 0..1 scale: with only two symbols the normalized
  // distribution sums to 1, so the probability of 'Y' *is* it.
  return { noul: probs[0]! };
}
