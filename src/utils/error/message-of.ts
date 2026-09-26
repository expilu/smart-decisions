/**
 * Human-readable message of any thrown value, `Error` or not.
 *
 * JavaScript can throw anything. `Error` instances carry a `message`, but values
 * thrown by other code paths (strings, numbers, response bodies, third-party
 * classes) do not. This reads the `message` property of `Error` instances and
 * stringifies everything else, so the result is always a usable string for
 * logging, error wrapping or user-facing messages.
 *
 * @param err - The thrown value, of any type.
 * @returns The `message` of `Error` instances, or the string representation of
 *          anything else.
 * @example
 * ```ts
 * messageOf(new Error('connection refused')); // 'connection refused'
 * messageOf(new DOMException('aborted', 'AbortError')); // 'aborted'
 * messageOf('boom'); // 'boom'
 * messageOf(42); // '42'
 * ```
 */
export const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
