# smart-decisions

## 0.5.0

### Minor Changes

- [#17](https://github.com/expilu/smart-decisions/pull/17) [`8c84db1`](https://github.com/expilu/smart-decisions/commit/8c84db1fc773411096e0d09e15d90ed04ae8635b) Thanks [@expilu](https://github.com/expilu)! - Add the `noul()` primitive: answers a yes/no question with the probability that the answer is "yes" (0..1).

## 0.4.0

### Minor Changes

- [#15](https://github.com/expilu/smart-decisions/pull/15) [`d88ce52`](https://github.com/expilu/smart-decisions/commit/d88ce525831e719570a27924d75edc9797b7b8f2) Thanks [@expilu](https://github.com/expilu)! - feat: `score()` — rate a position on a spectrum

  New `score()` primitive for decisions that are a position on a scale of ordered,
  described levels: its answer is a `score` (the probability-weighted mean of the
  level numbers, so it can fall between two levels), the per-level `probabilities`
  and `legend` keyed by level number as string, and the usual 0..1 `confidence`.
  Accepts 2..10 level descriptions in `criteria` (an ordered array, low end of the
  scale first); one dimension per question is recommended. Not implemented yet in System 2 mode.

- [#15](https://github.com/expilu/smart-decisions/pull/15) [`d88ce52`](https://github.com/expilu/smart-decisions/commit/d88ce525831e719570a27924d75edc9797b7b8f2) Thanks [@expilu](https://github.com/expilu)! - feat: shared System 1 core, shared mode router and the `Mode` type

  `choice()` System 1 answers are now produced through `src/system1/system1.ts` (the
  one-token logprobs engine any System 1 question type reuses) and `src/utils/mode/route-mode.ts`
  (the mode router: default to System 1, System 2 answers "Not implemented yet" from a single
  stub). New exported types: `Mode` (the shared `'system1' | 'system2'` union) and `BaseQuestion`
  (the fields every question type carries — `Question` extends it). No behavior change:
  same prompts, same responses, same errors.

## 0.3.0

### Minor Changes

- [#12](https://github.com/expilu/smart-decisions/pull/12) [`87127d5`](https://github.com/expilu/smart-decisions/commit/87127d58d79a06c086945782aea9f5b848a39149) Thanks [@expilu](https://github.com/expilu)! - **Breaking (pre-1.0):** the provider settings on `Question` moved into a new `Model` type.

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

## 0.2.0

### Minor Changes

- [#6](https://github.com/expilu/smart-decisions/pull/6) [`0cce138`](https://github.com/expilu/smart-decisions/commit/0cce13840ac31ea64b6023ffef296de493d836ef) Thanks [@expilu](https://github.com/expilu)! - Removed the `openai` SDK dependency: the library now talks to the OpenAI-compatible
  endpoint with an in-library HTTP transport.
