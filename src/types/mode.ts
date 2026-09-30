/**
 * Which mode answers a question, following Kahneman's dual-process theory
 * (Thinking, Fast and Slow): System 1 is fast, automatic and instinctive —
 * the immediate answer that comes to mind, and costs little in inference (one
 * forward pass, one generated token); System 2 is slow, effortful and
 * deliberate — reasoning applied to reach a considered verdict, and more
 * costly (the LLM may reason and has to generate a full structured response).
 *
 * @example
 * ```ts
 * const mode: Mode = 'system1';
 * ```
 */
export type Mode = 'system1' | 'system2';
