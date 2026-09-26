/**
 * Which mode to answer with, following Kahneman's dual-process theory (Thinking,
 * Fast and Slow): System 1 is fast, automatic and instinctive, and costs little
 * in inference (one forward pass, one generated token); System 2 is slow,
 * effortful and deliberate, and more costly (the LLM may reason and has to
 * generate a full structured response).
 *
 * @example
 * ```ts
 * const mode: ChoiceMode = 'system1';
 * ```
 */
export type ChoiceMode = 'system1' | 'system2';
