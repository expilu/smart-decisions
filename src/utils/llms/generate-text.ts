import { messageOf } from '../error/message-of.js';
import { truncate } from '../text/truncate.js';
import { sleep } from '../time/sleep.js';
import { readBodyCapped, isBodyTooLargeError } from '../network/read-body-capped.js';
import { backoffDelay } from '../network/backoff-delay.js';
import { isTimeoutError } from '../network/is-timeout-error.js';
import { retryDelayFromHeaders } from '../network/retry-delay-from-headers.js';
import { shouldRetryStatus } from '../network/should-retry-status.js';
import { VERSION } from '../../version.js';
import type { ChatCompletion } from '../../types/chat-completion.js';
import type { ChatCompletionRequest } from '../../types/chat-completion-request.js';
import type { GenerateTextOptions } from '../../types/generate-text-options.js';

/** Path of the OpenAI-compatible chat completions endpoint, relative to the base URL. */
const PATH = '/chat/completions';

// Transport defaults: 2 retries, 10 minutes per attempt.
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 600_000;
/** How many characters of an error body end up in thrown error messages. */
const MAX_ERROR_BODY_CHARS = 500;
/**
 * Safety cap on the buffered response body, in bytes. A one-token logprobs answer
 * is a few kilobytes at most, so this only ever fires on a misbehaving server —
 * and prevents it from exhausting the host process's memory.
 */
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

/**
 * Generates a chat completion from an OpenAI-compatible v1 API and returns its parsed
 * response — the thin, dependency-free transport layer shared by all the library modes
 * (System 1 today, System 2 later).
 *
 * The request is always a single non-streaming POST to `{apiBaseUrl}/chat/completions`
 * with Bearer authentication. Failed attempts — network errors, plus 408/409/429/5xx
 * responses or any `x-should-retry` answer — back off exponentially and are retried;
 * timeouts and oversized response bodies are not. Redirects are refused rather than
 * followed.
 *
 * @param connection - API endpoint and credentials, mirroring `Model`'s transport fields.
 * @param request - Chat completions request body in the API's own wire format. Extra
 *        engine- or model-specific fields (i.e. from `Model['extraBody']`) may be
 *        present alongside the standard keys; they are serialized into the body as is.
 * @param options - Retry and timeout settings; defaults to 2 retries with a 10-minute
 *        timeout per attempt. Non-finite `maxRetries` falls back to the default.
 * @returns The parsed response body. Response fields we don't consume are passed through untouched.
 * @throws If `apiBaseUrl` is not a valid URL, the API answers with a failing status,
 *         an unparsable or over-cap body, or keeps failing after every attempt.
 * @example
 * ```ts
 * const completion = await generateText(
 *   { apiBaseUrl: 'http://localhost:8000/v1', apiKey: 'no-key' },
 *   {
 *     model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *     messages: [{ role: 'user', content: 'Reply with a single letter: A or B' }],
 *     max_tokens: 1,
 *     temperature: 0,
 *     logprobs: true,
 *     top_logprobs: 20,
 *   },
 *   { maxRetries: 1, timeoutMs: 30_000 },
 * );
 * console.log(completion.choices[0]?.logprobs?.content?.[0]?.top_logprobs);
 * ```
 */
export async function generateText(
  connection: { apiBaseUrl: string; apiKey: string },
  request: ChatCompletionRequest,
  options: GenerateTextOptions = {},
): Promise<ChatCompletion> {
  // Sanitized, not just defaulted: a NaN from JS callers would make every
  // comparison against the attempt counter false and retry forever; negatives
  // degrade to 0 (one attempt) and fractions to whole attempts.
  const maxRetries =
    typeof options.maxRetries === 'number' && Number.isFinite(options.maxRetries)
      ? Math.max(0, Math.floor(options.maxRetries))
      : DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // The endpoint path is joined through the URL API so a query string on the base
  // URL (i.e. `https://host/v1?x=1`) survives the join instead of swallowing the
  // appended path.
  let url: URL;
  try {
    url = new URL(connection.apiBaseUrl);
  } catch (err) {
    throw new Error(`Invalid model.apiBaseUrl "${connection.apiBaseUrl}": ${messageOf(err)}`);
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}${PATH}`;
  // Errors are user-facing: some providers take credentials as query parameters,
  // and those must never leak into exception messages or logs.
  const displayUrl = `${url.origin}${url.pathname}`;

  // One full request per attempt, so maxRetries counts *retries*
  // (total attempts = maxRetries + 1).
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${connection.apiKey}`,
          'User-Agent': `smart-decisions/${VERSION}`,
        },
        body: JSON.stringify({ ...request, stream: false }),
        signal: AbortSignal.timeout(timeoutMs),
        // An API should never answer this call with a redirect; refusing to
        // follow one keeps the Bearer token off unexpected paths and avoids a
        // pointless round trip.
        redirect: 'error',
      });
      // Read before the status check: error responses carry their explanation in the
      // body, and it can only be consumed once. Capped: an oversized body is refused
      // instead of buffered (see MAX_RESPONSE_BYTES).
      text = await readBodyCapped(response, MAX_RESPONSE_BYTES);
    } catch (err) {
      // An over-cap body is deterministic: the same request cannot shrink on a
      // retry, so fail without burning the retry budget.
      if (isBodyTooLargeError(err)) {
        throw err;
      }
      // Timeouts are not retried: the full per-attempt budget was already spent, so
      // another wait just multiplies it. Any other fetch failure (connection refused,
      // reset, ...) is worth another attempt.
      if (isTimeoutError(err) || attempt >= maxRetries) {
        throw new Error(`LLM request to ${displayUrl} failed: ${messageOf(err)}`, { cause: err });
      }
      await sleep(backoffDelay(attempt));
      continue;
    }
    if (!response.ok) {
      if (attempt >= maxRetries || !shouldRetryStatus(response)) {
        throw new Error(
          `LLM API returned HTTP ${response.status}: ${truncate(text, MAX_ERROR_BODY_CHARS)}`,
        );
      }
      // The server's requested wait wins over our own backoff when it sends one.
      await sleep(retryDelayFromHeaders(response) ?? backoffDelay(attempt));
      continue;
    }
    try {
      return JSON.parse(text) as ChatCompletion;
    } catch {
      throw new Error(`LLM API returned invalid JSON: ${truncate(text, MAX_ERROR_BODY_CHARS)}`);
    }
  }
}
