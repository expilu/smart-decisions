import type { ChatCompletionRequest } from '../../types/chat-completion-request.js';

/**
 * Keys of the chat completions request body that `applyExtraBody` never lets an
 * `extraBody` override.
 *
 * They are exactly the request fields System 1's single-token logprobs trick
 * depends on for correctness — `model` and `messages` define what is asked,
 * `stream` keeps the response parsable, and `logprobs`, `top_logprobs`,
 * `max_tokens` and `temperature` make the first generated token the answer
 * distribution itself. Letting a user override any of them through `extraBody`
 * could silently corrupt the probability readout.
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'model',
  'messages',
  'stream',
  'logprobs',
  'top_logprobs',
  'max_tokens',
  'temperature',
]);

/** The request key that carries chat-template arguments on OpenAI-compatible engines. */
const CHAT_TEMPLATE_KWARGS = 'chat_template_kwargs';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Applies a `Model`'s `extraBody` to a chat completions request — the mechanism that
 * lets users reach engine- or model-specific settings this library does not model.
 *
 * Rules:
 * - Keys the library relies on for its own correctness (see `RESERVED_KEYS`) are
 *   ignored.
 * - `__proto__` and `constructor` are ignored: `extraBody` is an arbitrary-key
 *   passthrough, and an own enumerable `__proto__` key (i.e. smuggled through
 *   `JSON.parse`) must never be able to replace the request object's prototype.
 * - `chat_template_kwargs` (the llama.cpp / vLLM / SGLang thinking toggle) is merged
 *   one level deep, so engine defaults the library sets survive, user keys win per
 *   key, and sibling model-specific keys coexist (i.e. Qwen3's `enable_thinking`
 *   alongside DeepSeek's `thinking`). A non-object value for it is ignored, keeping
 *   the engine defaults intact.
 * - Every other key is forwarded verbatim; OpenAI-compatible engines ignore unknown
 *   body fields, so only the keys the backend understands take effect.
 *
 * @param request - Chat completions request body in the API's own wire format.
 * @param extraBody - Extra fields to forward, typically `Model['extraBody']`.
 * @returns A new request body with the extras applied; the input is never mutated.
 * @example
 * ```ts
 * const request = applyExtraBody(
 *   { model: 'm', messages: [], chat_template_kwargs: { enable_thinking: false } },
 *   { chat_template_kwargs: { thinking: false }, think: false },
 * );
 * // → { model: 'm', messages: [], chat_template_kwargs: { enable_thinking: false, thinking: false }, think: false }
 * ```
 */
export function applyExtraBody(
  request: ChatCompletionRequest,
  extraBody: Record<string, unknown> | undefined,
): ChatCompletionRequest {
  // No extras: return the request untouched, so the wire body stays byte-identical
  // to the pre-extraBody behavior.
  if (extraBody === undefined) {
    return request;
  }

  const merged: ChatCompletionRequest = { ...request };

  for (const [key, value] of Object.entries(extraBody)) {
    // Reserved keys are the library's own (see RESERVED_KEYS); skip silently.
    if (RESERVED_KEYS.has(key)) {
      continue;
    }

    // A computed __proto__ key is an own enumerable property Object.entries happily
    // yields; assigning it with [[Set]] would replace the request object's
    // prototype. Prototype keys never belong in a request body.
    if (key === '__proto__' || key === 'constructor') {
      continue;
    }

    // Chat template kwargs are special in both directions: a plain object merges one
    // level deep (user keys win per key, engine defaults survive, sibling model keys
    // coexist), and any non-object value is ignored so the defaults stay intact.
    if (key === CHAT_TEMPLATE_KWARGS) {
      if (isPlainObject(value)) {
        merged[CHAT_TEMPLATE_KWARGS] = {
          ...(merged[CHAT_TEMPLATE_KWARGS] as Record<string, unknown> | undefined),
          ...value,
        };
      }
      continue;
    }

    merged[key] = value;
  }

  return merged;
}
