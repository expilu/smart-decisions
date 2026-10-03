import type { ChatCompletionResponseFormat } from '../../types/response-format.js';

/**
 * The helpers that turn whatever text an engine sent back into validated
 * per-candidate ratings — System 2's counterpart of System 1's logprob
 * canonicalization.
 *
 * The fallback layer runs even when the engine enforced `response_format`:
 * grammar-while-thinking gaps, semi-compatible servers and reasoning-parser
 * differences mean the text can always arrive fenced, wrapped in think
 * blocks, or plainly unconstrained. Never trust the transport side alone.
 */

// The ChatML think markers, built from parts so no engine's template tokenizer
// ever sees them as a contiguous token: reasoning-capable engines without a
// reasoning parser inline them, and the code must strip/back whatever they
// produced. Case-insensitive on purpose: engines surface them differently.
const THINK_OPEN = `<th${'ink'}`;
const THINK_CLOSE = `</th${'ink'}`;

/** A reply's content split into visible answer and think blocks. */
export interface SplitReply {
  /** The visible answer — what remains once think blocks are out */
  clean: string;
  /** The concatenated thinking text, or `''` when the reply carried none */
  think: string;
}

/**
 * Split think blocks off the visible answer.
 *
 * Reasoning-capable engines without a reasoning parser inline their thinking
 * in the content itself — as think blocks in the ChatML convention, which
 * llama.cpp surfaces literally — before the final answer. The thinking text
 * is the model's deliberation; the answer is what survives the removal. An
 * unterminated trailing block (truncation mid-thinking) is removed too: the
 * visible answer after it is empty, which the caller treats as the failure
 * signal it is.
 *
 * @param text - The raw reply text as the engine returned it.
 * @returns The visible answer (`clean`) and the thinking text (`think`,
 *          `''` when the reply carried none).
 * @example
 * ```ts
 * const { clean, think } = splitThinking('<think>Looking…</think>{"a": 1}');
 * // → { clean: '{"a": 1}', think: 'Looking…' }
 * ```
 */
export function splitThinking(text: string): SplitReply {
  const blocks: string[] = [];
  // Closed blocks go first; a trailing unterminated one (truncation inside
  // the thinking) goes last, so an empty visible answer exposes it.
  const clean = text
    .replace(new RegExp(`${THINK_OPEN}([\\s\\S]*?)${THINK_CLOSE}`, 'gi'), (_all, body: string) => {
      blocks.push(body.trim());
      return '';
    })
    .replace(new RegExp(`${THINK_OPEN}([\\s\\S]*)$`, 'i'), (_all, body: string) => {
      blocks.push(body.trim());
      return '';
    });
  return { clean, think: blocks.join('\n').trim() };
}

/**
 * Extract the first JSON object out of a reply, tolerating everything an
 * uncooperative engine adds around it.
 *
 * The scan is brace-aware and string-aware (quotes and escapes inside string
 * literals do not count as braces), so prose containing braces before the
 * object cannot fool it. A reply that is exactly an object parses directly;
 * the scan covers fenced replies (` ```json ... ``` `) and prose-wraparound.
 *
 * @param text - The reply text, already free of think blocks.
 * @returns The parsed value of the first JSON object.
 * @throws `Parsing failed: ...` — no complete JSON object is in the text; the
 *         message is what the retry feedback shows back to the model.
 * @example
 * ```ts
 * extractJsonObject('Answer:\n```json\n{"a": 1}\n```');
 * // → { a: 1 }
 * ```
 */
export function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i]!;
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            // A span from '{' to its matching '}' parses as a JSON object by
            // construction; a parse failure means the text doesn't survive as JSON.
            return JSON.parse(candidate) as Record<string, unknown>;
          } catch (err) {
            throw new Error(`Parsing failed: does not parse as a JSON object — ${String(err)}`);
          }
        }
      }
    }
  }
  throw new Error('Parsing failed: no JSON object found in the reply');
}

/**
 * The ratings validator for the shared ratings schema: an object whose keys
 * are exactly the candidate identifiers and whose values are integers 0..10.
 *
 * @param value - The parsed JSON value to validate.
 * @param keys - The candidate identifiers, in the order the answer should
 *        come back.
 * @returns The ratings, keyed by identifier.
 * @throws A description of the first rule broken. These messages double as
 *         the retry feedback the model reads, so they say what to fix, not
 *         merely that it failed.
 * @example
 * ```ts
 * validateRatings({ walk: 8, movie: 2 }, ['walk', 'movie']);
 * // → { walk: 8, movie: 2 }
 * ```
 */
export function validateRatings(value: unknown, keys: readonly string[]): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`the reply must be a JSON object with the keys ${formatKeys(keys)}`);
  }
  const ratings: Record<string, number> = {};
  for (const key of keys) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) {
      throw new Error(`missing rating for "${key}" — every key needs a rating`);
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10) {
      throw new Error(`rating for "${key}" must be an integer from 0 to 10, got ${String(v)}`);
    }
    ratings[key] = v;
  }
  const extra = Object.keys(value as Record<string, unknown>).filter((k) => !keys.includes(k));
  if (extra.length > 0) {
    throw new Error(
      `unexpected key "${extra[0]}" — the reply must contain exactly ${formatKeys(keys)}`,
    );
  }
  return ratings;
}

const formatKeys = (keys: readonly string[]): string => keys.map((k) => `"${k}"`).join(', ');

/**
 * The shared ratings JSON Schema for `response_format`: one object, one
 * property per candidate identifier, each an integer 0..10, everything
 * required, nothing extra.
 *
 * Strict-compatible by construction, so the same document works on hosted
 * OpenAI (which rejects non-strict schemas) and on the grammar-converting
 * engines — minimality is the enforcement there: with only these properties
 * the model has nothing but its ratings to return.
 *
 * @param keys - The candidate identifiers, in the order their ratings should
 *        come back.
 * @returns The `response_format` field value of a chat completions request.
 * @example
 * ```ts
 * ratingsSchema(['walk', 'movie']);
 * // → { type: 'json_schema', json_schema: { name: 'ratings', schema: {...}, strict: true } }
 * ```
 */
export function ratingsSchema(keys: readonly string[]): ChatCompletionResponseFormat {
  const properties: Record<string, { type: 'integer'; minimum: 0; maximum: 10 }> = {};
  for (const key of keys) {
    properties[key] = { type: 'integer', minimum: 0, maximum: 10 };
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: 'ratings',
      schema: {
        type: 'object',
        properties: properties,
        required: [...keys],
        additionalProperties: false,
      },
      strict: true,
    },
  };
}
