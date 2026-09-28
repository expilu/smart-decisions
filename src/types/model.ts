/**
 * The model to query and the OpenAI-compatible v1 API serving it.
 *
 * Carries everything about *how the model is reached and served*: endpoint,
 * credentials, model identifier and any engine- or model-specific request settings
 * the library does not model. One `Model` describing, i.e., a deployed llama.cpp
 * server can back any number of `Question`s.
 *
 * @example
 * ```ts
 * const model: Model = {
 *   apiBaseUrl: 'http://localhost:8000/v1',
 *   apiKey: 'a-super-secret-api-key',
 *   model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
 * };
 * ```
 */
export interface Model {
  /** Base url of an OpenAI compatible v1 API, i.e. `'http://localhost:8000/v1'` */
  apiBaseUrl: string;
  /** The API key as required or not by your provider */
  apiKey: string;
  /** The model identifier as required by your API provider. i.e. `'/models/Qwen3.5-4B-Q4_K_M.gguf'` for llama.cpp */
  model: string;
  /**
   * Extra fields forwarded verbatim into the chat completions request body, for
   * engine- or model-specific request settings this library does not model.
   * OpenAI-compatible engines ignore unknown body fields, so only the keys your
   * backend understands take effect. i.e.:
   *
   * - `{ chat_template_kwargs: { enable_thinking: false } }` — reasoning/thinking
   *   toggle on llama.cpp, vLLM and SGLang (the exact key can differ per model:
   *   `enable_thinking` for Qwen3/GLM, `thinking` for DeepSeek-V3.1/Granite)
   * - `{ reasoning_effort: 'none' }` — OpenAI, OpenRouter and Ollama's
   *   `/v1/chat/completions`
   * - `{ think: false }` — Ollama native API
   *
   * Note: servers with strict body validation (the hosted OpenAI family) reject
   * genuinely unknown fields with HTTP 400.
   */
  extraBody?: Record<string, unknown>;
}
