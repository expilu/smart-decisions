/**
 * Retry and timeout settings for `generateText`.
 *
 * @example
 * ```ts
 * const options: GenerateTextOptions = { maxRetries: 3, timeoutMs: 30_000 };
 * ```
 */
export interface GenerateTextOptions {
  /** Retries after a failed attempt: network errors and 408/409/429/5xx responses (not timeouts). Defaults to 2 */
  maxRetries?: number | undefined;
  /** Per-attempt timeout in milliseconds. Defaults to 600000 */
  timeoutMs?: number | undefined;
}
