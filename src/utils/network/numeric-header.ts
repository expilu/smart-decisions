/**
 * Numeric value of an HTTP header, scaled by `multiplier`.
 *
 * Duration headers express themselves in different units (`retry-after-ms` in
 * milliseconds, `Retry-After` in seconds), and servers send junk: nothing at
 * all, HTTP-dates, negatives, absurdly large waits. This parses the raw value
 * with `Number.parseFloat`, scales it by `multiplier`, and only accepts the
 * result when it falls inside the `[0, maxMs]` range; everything else becomes
 * undefined so the caller can fall back to its own policy.
 *
 * @param value - Raw header value, as returned by `Headers.get()` (null when the
 *        header is absent).
 * @param multiplier - Scale applied to the parsed number (1 for a milliseconds
 *        header, 1000 for a seconds one).
 * @param maxMs - Inclusive upper bound, in milliseconds, the scaled value must
 *        not exceed.
 * @returns The scaled numeric value inside `[0, maxMs]`, or undefined when the
 *          value is absent, non-numeric, negative or above `maxMs`.
 * @example
 * ```ts
 * numericHeader('250', 1, 60_000); // 250
 * numericHeader('2', 1000, 60_000); // 2000 — 2 seconds scaled to milliseconds
 * numericHeader(null, 1, 60_000); // undefined — header absent
 * numericHeader('Sat, 26 Sep 2026 12:00:00 GMT', 1000, 60_000); // undefined — HTTP-date
 * numericHeader('-5', 1, 60_000); // undefined — negative
 * numericHeader('120', 1000, 60_000); // undefined — above the cap
 * ```
 */
export const numericHeader = (
  value: string | null,
  multiplier: number,
  maxMs: number,
): number | undefined => {
  if (value === null) return undefined;
  const parsed = Number.parseFloat(value);
  const delayMs = parsed * multiplier;
  return delayMs >= 0 && delayMs <= maxMs ? delayMs : undefined;
};
