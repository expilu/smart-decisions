/**
 * Which mode answers a question, following Kahneman's dual-process theory
 * (Thinking, Fast and Slow):
 *
 * - `'system1'` — fast, automatic and instinctive: the immediate answer that
 *   comes to mind, and costs little in inference (one forward pass, one
 *   generated token).
 * - `'system2'` — slow, effortful and deliberate: reasoning applied to reach a
 *   considered verdict, and more costly (the LLM may reason and has to generate
 *   a full structured response).
 * - `'auto'` — starts from System 1 and escalates to System 2, once, when the
 *   answer's confidence falls below `autoModeThreshold`. A low-confidence
 *   System 1 answer is exactly the case worth paying System 2's price for.
 *
 * @example
 * ```ts
 * const mode: Mode = 'system1';
 * ```
 */
export type Mode = 'system1' | 'system2' | 'auto';
