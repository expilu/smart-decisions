import type { NoulAnswer } from '../types/noul-answer.js';
import type { NoulQuestion } from '../types/noul-question.js';
import { routeMode } from '../utils/mode/route-mode.js';
import { system1Noul } from '../system1/noul.js';
import { system2Noul } from '../system2/noul.js';

/**
 * Answers a yes/no question with the probability that the answer is "yes".
 *
 * The question is routed to the selected mode, following Kahneman's dual-process
 * theory of the mind (Thinking, Fast and Slow): System 1 is fast, automatic and
 * instinctive — the immediate answer that comes to mind, costing one forward
 * pass and one token; System 2 is slow, effortful and deliberate — reasoning
 * applied to reach a considered verdict, slower and more costly.
 *
 * Use it when exactly one proposition is on trial and your code will threshold
 * the result — does this message request a refund, is this a repeat contact,
 * does this resume mention distributed systems. For two conditions that both
 *  must hold, ask two Nouls and combine them in code: one question judging two
 *  things at once answers none of them.
 *
 * Unlike `choice()` and `score()` there is no `confidence` field: the answer
 * distribution has only two outcomes, so `noul` describes it completely — a
 * value near 0.5 is both "no lean" and the low-confidence signal. Threshold
 * sensibly, and treat the near-0.5 band as a third path (human review) rather
 * than as data.
 *
 * @param question - The judgment to make: a yes/no question, state, optional
 *        criteria and the model to query.
 * @returns The yes/no answer on a scale from 0 (no) to 1 (yes).
 * @throws If `criteria` is provided and is not an object, or one of its
 *         descriptions is not a string. (In System 1 mode.)
 * @throws In System 2 mode (not implemented yet).
 * @throws If `mode` is not a known `Mode` value.
 * @example
 * ```ts
 * const answer = await noul({
 *   model: {
 *     apiBaseUrl: 'http://localhost:8000/v1',
 *     apiKey: process.env.API_KEY!,
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   },
 *   state: 'I have asked three times now. Can I please just talk to a real person?',
 *   instructions: 'Is the customer asking for a human agent?',
 *   criteria: {
 *     true: 'Explicitly asks for a person, agent or human',
 *     false: 'No sign of wanting a person',
 *   },
 * });
 *
 * if (answer.noul > 0.8) {
 *   routeToAgent(); // strong yes
 * } else if (answer.noul < 0.2) {
 *   routeToBot(); // strong no
 * } else {
 *   sendToReview(); // the model split itself — let a person decide
 * }
 * ```
 */
export async function noul(question: NoulQuestion): Promise<NoulAnswer> {
  // Guard against non-object values from JS callers, since TypeScript types
  // don't apply at runtime: a bare string would be silently ignored below.
  if (
    question.criteria !== undefined &&
    (typeof question.criteria !== 'object' || question.criteria === null)
  ) {
    throw new Error('criteria must be an object with true/false descriptions');
  }

  // Guard against non-string descriptions from JS callers, since TypeScript types don't apply at runtime.
  const descriptions: [string, string | undefined][] = [
    ['true', question.criteria?.true],
    ['false', question.criteria?.false],
  ];
  descriptions.forEach(([key, description]) => {
    if (description !== undefined && typeof description !== 'string') {
      throw new Error(`criteria.${key} must be a string, got ${typeof description}`);
    }
  });

  // Route through the shared mode router.
  // Default to System 1.
  //
  // Noul answers carry no confidence field (two outcomes describe the
  // distribution completely), so the confidence-equivalent for escalation is
  // the distance from the no-lean band: max(noul, 1 - noul).
  return routeMode(question, {
    system1: () => system1Noul(question),
    system2: () => system2Noul(question),
    confidence: (answer) => Math.max(answer.noul, 1 - answer.noul),
  });
}
