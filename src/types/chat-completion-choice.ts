import type { ChatCompletionTokenLogprob } from './chat-completion-token-logprob.js';

/**
 * The assistant message of one completion alternative, as returned by the API.
 *
 * Reasoning-enabled engines deliver the thinking text wherever their
 * conversion layer does: a separate `reasoning_content` field (llama.cpp,
 * vLLM, DeepSeek, Ollama), a `reasoning` field (OpenRouter), or — for engines
 * without a reasoning parser — inline think blocks inside `content` itself.
 * The separate fields are typed so callers-in-code can read them, but nothing
 * here should assume they exist: check, don't assume.
 */
export interface ChatCompletionMessage {
  /** Who is speaking: the assistant, on a fresh completion */
  role?: 'assistant' | string;
  /** The visible answer text; empty or missing when the token budget was consumed by reasoning or truncation */
  content?: string | null;
  /** The model's reasoning text when the engine separates it into its own field (llama.cpp, vLLM, DeepSeek, Ollama) */
  reasoning_content?: string | null;
  /** The model's reasoning text when the engine names it `reasoning` (OpenRouter) */
  reasoning?: string | null;
}

/**
 * One completion alternative as returned by the API.
 *
 * @example
 * ```ts
 * const choice: ChatCompletionChoice = {
 *   message: {
 *     role: 'assistant',
 *     content: '{ "...": "..." }',
 *     reasoning_content: 'Let me think...',
 *   },
 *   logprobs: {
 *     content: [{ token: 'A', logprob: -0.5, top_logprobs: [{ token: 'A', logprob: -0.5 }] }],
 *   },
 * };
 * ```
 */
export interface ChatCompletionChoice {
  /** The assistant message; absent only on a misbehaving server */
  message?: ChatCompletionMessage | null;
  /** Log probability information for the generated content, when requested */
  logprobs?: { content?: ChatCompletionTokenLogprob[] | null } | null;
}
