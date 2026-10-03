import type { BaseQuestion } from '../types/base-question.js';
import type { ChatCompletionRequest } from '../types/chat-completion-request.js';
import type { ChatMessage } from '../types/chat-message.js';
import { generateText } from '../utils/llms/generate-text.js';
import { applyExtraBody, SYSTEM2_RESERVED_KEYS } from '../utils/llms/apply-extra-body.js';
import { debugLog } from '../utils/debug/debug-log.js';
import {
  ratingsSchema,
  splitThinking,
  extractJsonObject,
  validateRatings,
} from '../utils/llms/structured-output.js';

/**
 * The deliberate half of the dual-process pair, shared by every System 2
 * answer type (`system2Choice`, `system2Score`, `system2Noul`).
 *
 * Where System 1 reads a distribution out of one generated token, System 2
 * lets the model deliberate — with or without thinking mode — and answer with
 * a minimal structured object: one integer 0..10 rating per candidate. The
 * ratings carry the whole answer: normalized they are the probability
 * distribution, their argmax decides, and the entropy over them is the
 * confidence, so the returned shapes stay byte-identical to System 1's.
 */

/** Transport defaults: 2 structure attempts (= 1 + 2 feedback retries). */
const DEFAULT_MAX_RETRIES = 2;

/**
 * The question fields `system2Ratings` reads, whatever the question type.
 */
export type RatingsQuestion = Pick<BaseQuestion, 'model' | 'maxRetries' | 'timeoutMs' | 'debug'> & {
  thinking?: boolean | undefined;
};

/**
 * Renders the System 2 prompt: the state, the instructions, the candidate
 * list and the closing instruction that pins the answer to one JSON rating
 * object.
 *
 * As in System 1 the candidate list is passed pre-rendered (each primitive
 * labels its entries its own way), but there is no symbol indirection here:
 * candidates are identified by their own names — the structured answer does
 * not ride on single tokens. The schema is stated in the prompt on purpose,
 * redundantly with `response_format`: engines that ignore the format field
 * still see the shape they must reply with, which is what makes the
 * parse/validate/retry fallback work everywhere.
 *
 * @param options - The prompt ingredients:
 *        `question` — the `state`/`instructions` to evaluate;
 *        `listLabel` — the heading of the rendered list, i.e. `'Options'` or
 *        `'Levels'`;
 *        `lines` — the already-rendered candidate lines, one per candidate,
 *        in the same order as `keys`;
 *        `keys` — the candidate identifiers to rate, rendered comma-separated.
 * @returns The full user-message prompt.
 * @example
 * ```ts
 * const prompt = system2Prompt({
 *   question: { state: '...', instructions: 'Which team?' },
 *   listLabel: 'Options',
 *   lines: ['returns — Exchanges items', 'shipping — Delays entregas'],
 *   keys: ['returns', 'shipping'],
 * });
 * ```
 */
export function system2Prompt(options: {
  question: Pick<BaseQuestion, 'state' | 'instructions'>;
  listLabel: string;
  lines: readonly string[];
  keys: readonly string[];
}): string {
  const { question, listLabel, lines, keys } = options;
  return (
    `${question.state}\n\n` +
    `${question.instructions}\n\n` +
    `${listLabel}:\n${lines.join('\n')}\n\n` +
    `Rate how well each candidate fits this state and these instructions: ` +
    `score each one with an integer from 0 (does not fit at all) to 10 (fits perfectly). ` +
    `Reply with a single JSON object with exactly these keys — ${keys.join(', ')} — ` +
    `each holding its rating, and nothing else in your answer.`
  );
}

/**
 * Builds the System 2 wire request over the ratings schema.
 *
 * The deliberate mode asks for:
 * - `response_format` json_schema — the strict-style ratings schema (one
 *   integer 0..10 per candidate), which every schema-capable engine enforces
 *   and which the prompt callback repeats for the rest;
 * - `temperature: 0` — deterministic verdicts (engines that reject the field,
 *   like OpenAI's reasoning models, get it cleared by the caller's
 *   `extraBody` null-deletion);
 * - no `max_tokens` — server defaults rule, so reasoning models are not
 *   starved of their deliberation budget by a too-small ceiling;
 * - the thinking knob when `thinking: false` — `reasoning_effort: 'none'`,
 *   the OpenAI-standard disable that this project verified is honored by
 *   llama.cpp too; anything else leaves the engine default (every reasoning
 *   model thinks by default).
 *
 * Engine-specific settings flow in last through `Model['extraBody']`, which
 * cannot override what System 2 needs (model/messages/stream/response_format)
 * but can reshape the rest.
 *
 * @param question - The model to query, its extra request settings, and the
 *        `thinking` verdict.
 * @param prompt - The full user-message prompt, typically built with
 *        `system2Prompt`.
 * @param keys - The candidate identifiers the schema enumerates.
 * @returns The request body in the API's own wire format.
 */
function system2Request(
  question: RatingsQuestion & { model: { model: string; extraBody?: Record<string, unknown> } },
  prompt: string,
  keys: readonly string[],
): ChatCompletionRequest {
  const request: ChatCompletionRequest = {
    model: question.model.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: ratingsSchema(keys),
  };
  // thinking: false is the only verdict a knob is needed for — 'none' is the
  // portable disable. true rides the engine default; undefined asks nothing.
  if (question.thinking === false) {
    request.reasoning_effort = 'none';
  }
  return applyExtraBody(request, question.model.extraBody, {
    reservedKeys: SYSTEM2_RESERVED_KEYS,
  });
}

/**
 * Asks the model, deliberately, to rate every candidate and returns the
 * validated ratings — the shared System 2 readout.
 *
 * The structured answer is retried with feedback: as long as the reply does
 * not parse or validate, the loop appends the model's own reply and what was
 * wrong with it ("your reply was not valid: ...") and asks again, bounded by
 * `maxRetries` (default 2). The self-correcting feedback is the layer that
 * makes structured output work on every engine: think-block-wrapped replies,
 * fenced JSON, and schema-less servers all funnel through the same parse and
 * the same validator, so an engine's structural shortcomings cost attempts,
 * not correctness.
 *
 * The model's reasoning text (`reasoning_content`/`reasoning` field, or
 * inline think blocks it left behind) is surfaced under `debug`, never in the
 * answer — the returned shapes stay identical to System 1's.
 *
 * @param question - The question's transport and thinking fields: `model`,
 *        `maxRetries`/`timeoutMs` overrides, `debug` and the `thinking`
 *        verdict.
 * @param prompt - The full user-message prompt, typically built with
 *        `system2Prompt`.
 * @param keys - The candidate identifiers to rate, in the order the
 *        distribution should come back.
 * @returns The validated ratings, keyed by identifier — parse them later per
 *        question type (choice averages, score weighs, noul takes a ratio).
 * @throws When `maxRetries` attempts fail to produce valid ratings — the last
 *         validation reason travels with the error, so the failure is
 *         diagnosable from the outside.
 * @example
 * ```ts
 * const ratings = await system2Ratings(question, prompt, ['walk', 'movie']);
 * // → { walk: 8, movie: 2 }
 * ```
 */
export async function system2Ratings(
  question: RatingsQuestion,
  prompt: string,
  keys: readonly string[],
): Promise<Record<string, number>> {
  debugLog(question.debug, 'system2', 'prompt', prompt);

  // Sanitized, not just defaulted: a NaN from JS callers would make every
  // comparison against the attempt counter false and retry forever; negatives
  // degrade to 0 (one attempt) and fractions to whole attempts.
  const maxRetries =
    typeof question.maxRetries === 'number' && Number.isFinite(question.maxRetries)
      ? Math.max(0, Math.floor(question.maxRetries))
      : DEFAULT_MAX_RETRIES;

  const body = system2Request(question, prompt, keys);
  const messages: ChatMessage[] = [...(body.messages as ChatMessage[])];
  let lastReason = '';

  // Structure attempts = maxRetries + 1. Inside one attempt the transport may
  // retry connection failures with its own budget; these retries are about
  // the answer's shape, a different failure surface.
  for (let attempt = 0; ; attempt++) {
    const res = await generateText(
      { apiBaseUrl: question.model.apiBaseUrl, apiKey: question.model.apiKey },
      { ...body, messages } as ChatCompletionRequest,
      { maxRetries: question.maxRetries, timeoutMs: question.timeoutMs, debug: question.debug },
    );

    const message = res.choices[0]?.message;
    const raw = message?.content ?? '';
    const split = splitThinking(raw);
    // Reasoning text comes from wherever the engine left it: a dedicated
    // field, or inline think blocks. Surfaced under debug only.
    const reasoning = message?.reasoning_content ?? message?.reasoning ?? split.think;
    if (reasoning) {
      debugLog(question.debug, 'system2', 'reasoning', reasoning);
    }

    try {
      if (!split.clean.trim()) {
        // Empty visible answer: the budget was consumed by reasoning or the
        // reply was truncated (finish_reason length). Retrying with feedback
        // is the recovery; silently returning an empty answer is not.
        throw new Error('the reply carried no answer text (only reasoning or nothing)');
      }
      const parsed = extractJsonObject(split.clean);
      const ratings = validateRatings(parsed, keys);
      debugLog(question.debug, 'system2', 'ratings', JSON.stringify(ratings));
      return ratings;
    } catch (err) {
      // The engine's own call stack throws only Error instances, so the cast
      // is sound; a stray non-Error throw would surface as an undefined
      // reason rather than crashing the retry loop.
      lastReason = (err as Error).message;
      debugLog(
        question.debug,
        'system2',
        `structured answer rejected (attempt ${attempt + 1})`,
        lastReason,
      );
    }

    if (attempt >= maxRetries) {
      throw new Error(
        `system2 could not get a valid structured answer after ${attempt + 1} attempts: ${lastReason}`,
      );
    }
    // The feedback loop: the model sees its own reply and what was wrong with
    // it, and answers against the rejection, not from scratch.
    if (split.clean.trim()) {
      messages.push({ role: 'assistant', content: split.clean.trim() });
    }
    messages.push({
      role: 'user',
      content: `Your reply was not valid: ${lastReason}. Reply again with only the JSON object.`,
    });
  }
}
