import { numericHeader } from './numeric-header.js';

/** `Retry-After` values above 60 seconds are discarded as unreasonable. */
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Milliseconds to wait before a retry, as requested by the response headers.
 *
 * Follows the de-facto retry conventions of OpenAI-compatible APIs: the
 * non-standard `retry-after-ms` (milliseconds) wins when present, otherwise the
 * standard `Retry-After` (seconds) is used. The HTTP-date form of `Retry-After`
 * is not supported, and waits above 60 seconds are discarded.
 *
 * @param response - The failed HTTP response whose headers may carry retry hints.
 * @returns Milliseconds to wait, or undefined when no header carries a usable
 *          numeric value.
 * @example
 * ```ts
 * retryDelayFromHeaders(new Response(null, { headers: { 'retry-after-ms': '250' } })); // 250
 * retryDelayFromHeaders(new Response(null, { headers: { 'retry-after': '2' } })); // 2000
 * retryDelayFromHeaders(new Response(null)); // undefined — no usable hint
 * ```
 */
export const retryDelayFromHeaders = (response: Response): number | undefined => {
  const ms = numericHeader(response.headers.get('retry-after-ms'), 1, MAX_RETRY_AFTER_MS);
  if (ms !== undefined) return ms;
  return numericHeader(response.headers.get('retry-after'), 1000, MAX_RETRY_AFTER_MS);
};
