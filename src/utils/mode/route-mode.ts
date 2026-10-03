import type { Mode } from '../../types/mode.js';
import type { ModeQuestion } from '../../types/mode-fields.js';
import { debugLog } from '../debug/debug-log.js';

/**
 * The question fields the router reads to dispatch and to enforce the
 * mode-validity of the System 2 knobs. The caller passes its full question;
 * nothing else is read, so extra fields stay the caller's business.
 */
type RoutedQuestion = Pick<ModeQuestion, 'mode' | 'thinking' | 'autoModeThreshold' | 'debug'>;

/**
 * The per-mode answer handlers of one question type, plus how its System 1
 * answer's confidence is extracted for `'auto'` escalation.
 *
 * `system2` and `confidence` stay optional while System 2 is not wired for the
 * calling question type: with them missing, a `'system2'`/`'auto'` ask throws
 * `'Not implemented yet'` instead of crashing elsewhere.
 */
export interface ModeHandlers<T> {
  /** The System 1 handler for the calling question type */
  system1: () => Promise<T>;
  /** The System 2 handler, once the question type implements it */
  system2?: () => Promise<T>;
  /**
   * Extracts the 0..1 confidence of a System 1 answer, so `'auto'` mode knows
   * when to escalate: `choice()`/`score()` return it directly; `noul()` derives
   * it as `max(noul, 1 - noul)`
   */
  confidence?: (answer: T) => number;
}

/**
 * Routes a question to its per-mode answer implementation — the single seam
 * every question type (`choice()`, `score()`, ...) goes through, so the mode
 * default, the knob validation and the `'auto'` escalation live in exactly one
 * place.
 *
 * The mode rules:
 * - `undefined` defaults to `'system1'`.
 * - `'system1'` runs the System 1 handler.
 * - `'system2'` runs the System 2 handler when the question type implements
 *   it, and throws `'Not implemented yet'` otherwise.
 * - `'auto'` runs System 1 first and escalates to System 2 — once — when the
 *   answer's confidence is below `autoModeThreshold` (default 0.7). The
 *   escalated answer is returned as-is, whatever its confidence: one
 *   escalation, never a loop. Without a System 2 handler it throws
 *   `'Not implemented yet'`.
 * - Anything else throws `'Unsupported mode'`, which a JS caller can pass
 *   since TypeScript types don't apply at runtime.
 *
 * The mode-validity of the System 2 knobs is enforced here for JS callers
 * (TypeScript callers are rejected at compile time by the mode-partitioned
 * union): `thinking` is only valid when the mode is `'system2'` or `'auto'`,
 * and `autoModeThreshold` is only valid in `'auto'` mode — both throw loudly
 * rather than being silently ignored.
 *
 * @param question - The question being answered; only `mode`, `thinking` and
 *        `autoModeThreshold` are read.
 * @param handlers - The per-mode handlers, plus the confidence extractor when
 *        `'auto'` mode applies.
 * @returns Whatever the selected handler resolves to.
 * @throws `'Not implemented yet'` when the question asked for a mode the type
 *         does not implement yet.
 * @throws `'Unsupported mode'` for any other `mode` value.
 * @throws `"thinking is only valid when mode is 'system2' or 'auto'"` when a
 *         JS caller sets `thinking` outside those modes.
 * @throws `"autoModeThreshold is only valid in mode 'auto'"` when a JS caller
 *         sets it outside `'auto'` mode.
 * @throws `'autoModeThreshold must be a number between 0 and 1, got ...'` when
 *         the threshold is not a finite number in range.
 * @example
 * ```ts
 * return routeMode(question, {
 *   system1: () => system1Choice(question),
 *   system2: () => system2Choice(question),
 *   confidence: (answer) => answer.confidence,
 * });
 * ```
 */
export async function routeMode<T>(
  question: RoutedQuestion,
  handlers: ModeHandlers<T>,
): Promise<T> {
  // Default to System 1
  const mode: Mode = question.mode ?? 'system1';

  // The System 2 knobs throw loudly when a JS caller sets them on a question
  // their mode cannot use: silence here would look like the knob did work.
  // `as unknown` keeps the wider runtime truth the TS types have ruled out.
  const thinking = question.thinking as unknown;
  const threshold = question.autoModeThreshold as unknown;

  if (thinking !== undefined && mode !== 'system2' && mode !== 'auto') {
    throw new Error("thinking is only valid when mode is 'system2' or 'auto'");
  }

  if (threshold !== undefined) {
    if (mode !== 'auto') {
      throw new Error("autoModeThreshold is only valid in mode 'auto'");
    }
    // A JS caller can pass anything: keep the escalation math honest by
    // rejecting non-finite and out-of-range values instead of comparing them.
    if (
      typeof threshold !== 'number' ||
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > 1
    ) {
      throw new Error(
        `autoModeThreshold must be a number between 0 and 1, got ${String(threshold)}`,
      );
    }
  }

  if (mode === 'system1') {
    return await handlers.system1();
  }

  if (mode === 'system2') {
    if (!handlers.system2) {
      // TODO: remove once every question type implements System 2.
      throw new Error('Not implemented yet');
    }
    return await handlers.system2();
  }

  if (mode === 'auto') {
    // System 1 always runs first: a confident answer never needs System 2.
    const system1Answer = await handlers.system1();
    if (!handlers.confidence) {
      // TODO: remove once every question type implements System 2.
      // Without a confidence reader the escalation decision cannot be made at
      // all, so there is no answer 'auto' can honestly hand back.
      throw new Error('Not implemented yet');
    }
    // The threshold defaults here; NaN-style garbage is impossible because the
    // validation above demanded a finite in-range number.
    const thresholdOf = question.autoModeThreshold ?? 0.7;
    const confidence = handlers.confidence(system1Answer);
    // The escalation is a decision worth seeing from the outside in hindsight:
    // which pass answered, and why.
    debugLog(
      question.debug,
      'auto',
      confidence < thresholdOf
        ? `confidence ${formatConfidence(confidence)} < threshold ${formatConfidence(thresholdOf)} — escalating to System 2`
        : `confidence ${formatConfidence(confidence)} ≥ threshold ${formatConfidence(thresholdOf)} — keeping the System 1 answer`,
    );
    if (confidence < thresholdOf) {
      if (!handlers.system2) {
        // TODO: remove once every question type implements System 2.
        throw new Error('Not implemented yet');
      }
      const escalated = await handlers.system2();
      // Returned as-is, even at low confidence: one escalation, not a loop.
      return escalated;
    }
    return system1Answer;
  }

  throw new Error('Unsupported mode');
}

/** Confidence values go into logs rounded to 2 decimals — detail, not noise. */
function formatConfidence(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}
