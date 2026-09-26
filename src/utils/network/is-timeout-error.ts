/**
 * Whether the thrown value is a timeout abort, as opposed to a caller abort or
 * any other failure.
 *
 * When a request's `AbortSignal.timeout(ms)` fires, the pending promise rejects
 * with a `TimeoutError`; an explicit `AbortController.abort()` rejects with an
 * `AbortError`, and network failures reject with a `TypeError`. Telling them
 * apart lets callers decide what a failure means — i.e. that a timeout already
 * consumed its whole budget and must not be retried.
 *
 * @param err - The thrown value, of any type.
 * @returns Whether the value is an `Error` whose `name` is `TimeoutError`.
 * @example
 * ```ts
 * isTimeoutError(new DOMException('timed out', 'TimeoutError')); // true
 * isTimeoutError(new DOMException('user abort', 'AbortError')); // false
 * isTimeoutError(new Error('fetch failed')); // false
 * isTimeoutError('boom'); // false
 * ```
 */
export const isTimeoutError = (err: unknown): boolean =>
  err instanceof Error && err.name === 'TimeoutError';
