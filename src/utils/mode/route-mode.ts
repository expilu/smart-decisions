import type { Mode } from '../../types/mode.js';

/**
 * Routes a question's `mode` to its per-mode answer implementation — the single
 * seam every question type (`choice()`, `score()`, ...) goes through, so the
 * mode default and the not-yet-implemented System 2 stub live in exactly one
 * place.
 *
 * Following Kahneman's dual-process theory (Thinking, Fast and Slow): System 1
 * is the fast, automatic, single-forward-pass answer; System 2 — slow,
 * deliberate, structured — is the same route for every question type once it
 * exists.
 *
 * @param mode - The asked mode. `undefined` means the default, System 1.
 * @param system1 - The System 1 handler for the calling question type, invoked
 *        only when System 1 is selected (so a System 2 ask never touches it).
 * @returns Whatever the System 1 handler resolves to.
 * @throws `'Not implemented yet'` in System 2 mode — supported by the types,
 *         arriving with the future System 2 implementation.
 * @throws `'Unsupported mode'` for any other value, which a JS caller can pass
 *         since TypeScript types don't apply at runtime.
 * @example
 * ```ts
 * return routeMode(question.mode, () => system1Choice(question));
 * ```
 */
export async function routeMode<T>(mode: Mode | undefined, system1: () => Promise<T>): Promise<T> {
  // Default to System 1
  const selected = mode ?? 'system1';

  if (selected === 'system1') {
    return await system1();
  } else if (selected === 'system2') {
    // TODO: implement system2.
    throw new Error('Not implemented yet');
  } else {
    // Unreachable from TypeScript, but keeps JS callers honest with a clear error.
    throw new Error('Unsupported mode');
  }
}
