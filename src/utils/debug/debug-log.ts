/**
 * The debug logging shared by every mode: one tiny, dependency-free entry
 * point the transport (`generateText`) and the engines call with their flag
 * passed explicitly — no global mutable state, the caller's `debug` question
 * field is the only authority.
 */

/** ANSI dark gray (bright black); applied to the whole log payload. */
const GRAY = '\x1b[90m';
/** ANSI reset, ending the gray span. */
const RESET = '\x1b[0m';

/** The payload cap, reusing the error-body rule: debug lines detail, not dump. */
const MAX_PAYLOAD_CHARS = 2000;

/**
 * Emits one debug entry to stderr in dark gray.
 *
 * The entry is `「[smart-decisions:<where>]」` followed by its payload, all
 * wrapped in the gray ANSI span when the target stream supports color.
 * Color support is detected per call from the stream itself: a TTY without
 * `NO_COLOR` set gets the color, everything else (piped output, CI logs)
 * gets plain text, because terminals and log collectors choke on ANSI codes.
 *
 * The rule this logger never breaks: credentials and URLs' query parameters
 * never reach a log line; call sites own that (and the transport already
 * builds credential-free endpoint labels for its errors).
 *
 * @param enabled - Whether to emit at all. Straight from the question's
 *        `debug` field, spread by the transport/engines; `undefined` counts
 *        as off.
 * @param where - The emitting layer, i.e. `'transport'`, `'system1'`,
 *        `'system2'` — it names the origin in every line.
 * @param label - What happened, short; the first line of the entry.
 * @param payload - The detail: full text or values below it. Truncated to a
 *        2000-character cap. Multi-line payloads are colorized as one span.
 * @param stream - Where to write; injectable so tests can observe stderr's
 *        exact bytes without touching the real one. Defaults to `stderr`.
 * @returns `void` — logging never alters the answer.
 * @example
 * ```ts
 * const prompt = system1Prompt(...);
 * debugLog(question.debug, 'system1', 'prompt', prompt);
 * const res = await generateText(..., { debug: question.debug });
 * ```
 */
export function debugLog(
  enabled: boolean | undefined,
  where: string,
  label: string,
  payload?: unknown,
  stream: {
    isTTY?: boolean | undefined;
    hasColors?: ((count?: number) => boolean) | undefined;
    write?: (chunk: string) => unknown;
  } = process.stderr,
): void {
  if (!enabled) {
    return;
  }
  // Per-call detection piped through the stream (see hasColors): real TTYs and
  // test doubles both go through the same path.
  const colored = stream.isTTY === true && stream.hasColors?.(2) !== false && !process.env.NO_COLOR;
  const text = payload === undefined ? label : `${label}\n${String(payload)}`;
  const capped = text.length > MAX_PAYLOAD_CHARS ? `${text.slice(0, MAX_PAYLOAD_CHARS)}…` : text;
  const body = colored ? `${GRAY}${capped}${RESET}` : capped;
  stream.write?.(`[smart-decisions:${where}] ${body}\n`);
}
