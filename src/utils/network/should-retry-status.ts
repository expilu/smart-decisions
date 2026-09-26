/**
 * Whether an HTTP response is worth retrying.
 *
 * The non-standard `x-should-retry` header wins when the server sends it (`true`
 * or `false`), otherwise only request timeouts (408), lock timeouts (409), rate
 * limits (429) and server errors (>= 500) are considered retryable. Everything
 * else is final: validation errors, auth failures and the like would fail again
 * the same way.
 *
 * @param response - The failed HTTP response to classify.
 * @returns Whether the request should be attempted again.
 * @example
 * ```ts
 * shouldRetryStatus(new Response(null, { status: 503 })); // true
 * shouldRetryStatus(new Response(null, { status: 400 })); // false
 * shouldRetryStatus(
 *   new Response(null, { status: 400, headers: { 'x-should-retry': 'true' } }),
 * ); // true — the server explicitly asks for a retry
 * ```
 */
export const shouldRetryStatus = (response: Response): boolean => {
  // Not a standard header, but when a server bothers to send it, obey it.
  const shouldRetry = response.headers.get('x-should-retry');
  if (shouldRetry === 'true') return true;
  if (shouldRetry === 'false') return false;
  return (
    response.status === 408 ||
    response.status === 409 ||
    response.status === 429 ||
    response.status >= 500
  );
};
