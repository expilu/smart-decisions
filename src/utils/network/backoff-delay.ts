/** Base delay of the first retry, in milliseconds. */
const BACKOFF_BASE_MS = 500;
/** Upper bound of the backoff delay, in milliseconds. */
const BACKOFF_MAX_MS = 8_000;

/**
 * Exponential backoff delay to wait before the retry that follows the given
 * attempt.
 *
 * The delay doubles with every failed attempt and is capped at 8 seconds, so a
 * struggling server is not hammered again immediately while short hiccups still
 * converge fast:
 *
 * | attempt | delay    |
 * | ------- | -------- |
 * | 0       | 500ms    |
 * | 1       | 1s       |
 * | 2       | 2s       |
 * | 3       | 4s       |
 * | 4+      | 8s (cap) |
 *
 * @param attempt - Zero-based index of the attempt that just failed.
 * @returns Milliseconds to wait before the next attempt.
 * @example
 * ```ts
 * backoffDelay(0); // 500
 * backoffDelay(1); // 1000
 * backoffDelay(3); // 4000
 * backoffDelay(10); // 8000 — capped
 * ```
 */
export const backoffDelay = (attempt: number): number =>
  Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
