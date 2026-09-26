import type { ChatMessage } from './chat-message.js';

/**
 * Chat completions request body, in the wire format of the OpenAI-compatible
 * `/v1/chat/completions` API.
 *
 * Keys are kept verbatim from the API spec, so no mapping layer is needed
 * between this type and the request body.
 *
 * @example
 * ```ts
 * const request: ChatCompletionRequest = {
 *   model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 *   messages: [{ role: 'user', content: 'Reply with a single letter: A or B' }],
 *   max_tokens: 1,
 *   temperature: 0,
 *   logprobs: true,
 *   top_logprobs: 20,
 * };
 * ```
 */
export interface ChatCompletionRequest {
  /** The model identifier as required by the API provider */
  model: string;
  /** The conversation so far */
  messages: ChatMessage[];
  /** Maximum number of tokens to generate */
  max_tokens?: number;
  /** Sampling temperature; 0 makes generation (near-)greedy */
  temperature?: number;
  /** Whether to return log probabilities of the generated tokens */
  logprobs?: boolean;
  /** How many of the most likely tokens to report at each position (requires `logprobs`) */
  top_logprobs?: number;
  /** Extra parameters forwarded to the model's chat template, i.e. `{ enable_thinking: false }` for llama.cpp */
  chat_template_kwargs?: Record<string, unknown>;
}
