/**
 * Retry, timeout and debug settings for `generateText`.
 *
 * @example
 * ```ts
 * const options: GenerateTextOptions = { maxRetries: 3, timeoutMs: 30_000, debug: true };
 * ```
 */
export interface GenerateTextOptions {
  /** Retries after a failed attempt: network errors and 408/409/429/5xx responses (not timeouts). Defaults to 2 */
  maxRetries?: number | undefined;
  /** Per-attempt timeout in milliseconds. Defaults to 600000 */
  timeoutMs?: number | undefined;
  /**
   * Debug logging of the transport internals: the wire request body, the
   * endpoint, the HTTP status, the raw response text, and every retry with
   * its reason and backoff — to stderr, plain or dark gray (see
   * `debugLog`). Credentials and URLs' query parameters are never logged.
   * Straight from the question's `debug` field. Defaults to false
   */
  debug?: boolean | undefined;
}
