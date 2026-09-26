import { messageOf } from '../error/message-of.js';
import { truncate } from '../text/truncate.js';
import { sleep } from '../time/sleep.js';
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
 * Generates a chat completion from an OpenAI-compatible v1 API and returns its parsed
 * response — the thin, dependency-free transport layer shared by all the library modes
 * (System 1 today, System 2 later).
 *
 * The request is always a single non-streaming POST to `{apiBaseUrl}/chat/completions`
 * with Bearer authentication. Failed attempts — network errors, plus 408/409/429/5xx
 * responses or any `x-should-retry` answer — back off exponentially and are retried;
 * timeouts are not.
 *
 * @param connection - API endpoint and credentials, mirroring `Question`'s provider settings.
 * @param request - Chat completions request body in the API's own wire format.
 * @param options - Retry and timeout settings; defaults to 2 retries with a 10-minute
 *        timeout per attempt.
 * @returns The parsed response body. Response fields we don't consume are passed through untouched.
 * @throws If the API answers with a failing status, an unparsable body, or keeps failing
 *         after every attempt.
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
  // Not validated on purpose: 0 retries means exactly one attempt, a tiny timeout aborts
  // immediately, and negative values degrade monotonically in the same direction.
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // A trailing slash on the base URL must not double when appending the path.
  const url = new URL(
    connection.apiBaseUrl.endsWith('/')
      ? connection.apiBaseUrl + PATH.slice(1)
      : connection.apiBaseUrl + PATH,
  );

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
      });
      // Read before the status check: error responses carry their explanation in the
      // body, and it can only be consumed once.
      text = await response.text();
    } catch (err) {
      // Timeouts are not retried: the full per-attempt budget was already spent, so
      // another wait just multiplies it. Any other fetch failure (connection refused,
      // reset, ...) is worth another attempt.
      if (isTimeoutError(err) || attempt >= maxRetries) {
        throw new Error(`LLM request to ${url} failed: ${messageOf(err)}`, { cause: err });
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
