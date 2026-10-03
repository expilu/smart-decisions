import type { BaseQuestion } from './base-question.js';

/**
 * The fields System 1-mode questions carry: no System 2-only knobs at all.
 *
 * System 1's single-token logprob trick is hard-wired to answer without any
 * deliberation, so `thinking` is meaningless there and `autoModeThreshold`
 * (which steers the escalation *into* System 2) never fires. Both are typed
 * with `never`: absent they match the System 1 shape, present they are a
 * compile-time type error for TypeScript callers and a loud runtime error for
 * JS callers.
 *
 * @example
 * ```ts
 * const system1: System1Fields = { mode: 'system1' };
 * // @ts-expect-error — thinking is System 2-only
 * const broken: System1Fields = { mode: 'system1', thinking: true };
 * ```
 */
export interface System1Fields {
  /** Optional: an omitted `mode` defaults to System 1, so `{}` still works */
  mode?: 'system1';
  /** Never a System 1 field: present values are a compile-time error */
  thinking?: never;
  /** Never a System 1 field: present values are a compile-time error */
  autoModeThreshold?: never;
}

/**
 * The fields a `mode: 'system2'` question carries.
 *
 * `mode` is required here on purpose: asking System 2-only knobs is only
 * meaningful when the question states the mode it wants them for, so the
 * combination is spelled out, never defaulted into.
 *
 * @example
 * ```ts
 * const system2: System2Fields = { mode: 'system2', thinking: true };
 * // @ts-expect-error — the threshold rides along only in 'auto' mode
 * const broken: System2Fields = { mode: 'system2', autoModeThreshold: 0.7 };
 * ```
 */
export interface System2Fields {
  mode: 'system2';
  /**
   * Deliberate reasoning behind the structured answer. `true` requests
   * thinking; `false` requests its disable (`reasoning_effort: 'none'`) and
   * `undefined` leaves whatever the engine's template does by default — every
   * reasoning model thinks by default. Engines that need different keys take
   * them via `Model['extraBody']`. Only meaningful when the model has a
   * thinking/reasoning mode
   */
  thinking?: boolean;
  /** Only `'auto'` mode consumes the threshold: here it is again a compile-time error */
  autoModeThreshold?: never;
}

/**
 * The fields an `mode: 'auto'` question carries: both the System 2 knobs and
 * the escalation threshold.
 *
 * @example
 * ```ts
 * const auto: AutoFields = { mode: 'auto', thinking: false, autoModeThreshold: 0.8 };
 * ```
 */
export interface AutoFields {
  mode: 'auto';
  /**
   * Same semantics as {@linkcode System2Fields['thinking']}: the escalated
   * System 2 pass is the one affected; the first, System 1 pass always answers
   * without reasoning
   */
  thinking?: boolean;
  /**
   * Confidence under which `'auto'` escalates to System 2. System 1 answers
   * with a confidence 0..1 (flat distribution → 0, single peak → 1); for
   * noul's two-outcome judgment the confidence equivalent is
   * `max(noul, 1 - noul)`. Must be a finite number between 0 and 1.
   * Defaults to 0.7
   */
  autoModeThreshold?: number;
}

/**
 * The mode-partitioned shape every question type is built from
 * (`Question`, `ScoreQuestion`, `NoulQuestion`).
 *
 * The union puts the mode-validity of the System 2 knobs under the type
 * checker while keeping the ergonomic default: without `mode`, the System 1
 * member applies and its `never`-typed knobs reject anything else. At runtime
 * the same rules are enforced with loud errors for JS callers, in the shared
 * mode router. Verified against the project's strictest TS settings: exactly
 * the illegal combinations reject, legal ones (including `'auto'` with both
 * knobs) compile, and the union still narrows (`if (q.mode === 'system2')`).
 *
 * @example
 * ```ts
 * const q: ModeQuestion = { model: ..., state: ..., instructions: ... }; // System 1
 * const q2: ModeQuestion = { ..., mode: 'auto', autoModeThreshold: 0.8 };
 * ```
 */
export type ModeQuestion = BaseQuestion & (System1Fields | System2Fields | AutoFields);
