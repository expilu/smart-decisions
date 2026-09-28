---
'smart-decisions': minor
---

**Breaking (pre-1.0):** the provider settings on `Question` moved into a new `Model` type.

- `apiBaseUrl`, `apiKey` and `model` no longer sit flat on `Question`; they are now
  `question.model.{apiBaseUrl, apiKey, model}`. This groups everything about how the
  model is reached and served into one reusable object to pass to every `choice()`.
- `Model` gains `extraBody`: extra fields forwarded verbatim into the chat completions
  request body for engine- or model-specific settings (i.e. `chat_template_kwargs`
  thinking toggles on llama.cpp/vLLM/SGLang, `reasoning_effort` on OpenAI/OpenRouter/
  Ollama, Ollama's native `think`). Reserved request keys the library's single-token
  trick depends on (`model`, `messages`, `stream`, `logprobs`, `top_logprobs`,
  `max_tokens`, `temperature`) cannot be overridden through it; `chat_template_kwargs`
  merges one level deep with user keys winning per key.
- System 1's request now asks for `top_logprobs: 20` instead of 50: 20 is the highest
  portable window (OpenAI and OpenRouter cap it at 20, vLLM's server default
  `--max-logprobs` is 20). On llama.cpp (accepts up to 50) the smaller window is
  enough for realistic option counts.
- New `Model` type exported from the package root; `generateText` accepts extra
  top-level body fields via `ChatCompletionRequest`'s index signature.

### Hardening

- The transport no longer follows redirects (`redirect: 'error'`): the Bearer token
  stays off unexpected paths, and a misconfigured base URL fails loudly.
- Response bodies are read under a 10 MB safety cap instead of being buffered
  unconditionally; an over-cap body fails fast and is not retried. A declared
  `Content-Length` over the cap is refused before reading anything.
- Non-finite `maxRetries` (i.e. `NaN`) no longer causes an infinite retry loop: it
  falls back to the default, negatives clamp to 0 and fractions to whole attempts.
- `extraBody` ignores `__proto__` and `constructor` keys, so prototype-smuggled
  config can never re-parent the request object.
- Malformed entries inside `top_logprobs` (missing/null token) are skipped instead
  of crashing mid-read.
- Error messages strip query strings from the request URL, so providers that take
  credentials as query parameters cannot leak them into logs.
- The endpoint path is joined through the URL API, preserving a query string in
  `apiBaseUrl` instead of swallowing it, and an invalid base URL throws a clear
  `Invalid model.apiBaseUrl` error.
- CI actions are pinned by commit SHA; the release script spawns every subprocess
  as an argv array (no shell), so interpolated values can never be re-parsed as
  shell syntax.
