# smart-decisions

[![npm](https://img.shields.io/npm/v/smart-decisions.svg)](https://www.npmjs.com/package/smart-decisions)
[![CI](https://github.com/expilu/smart-decisions/actions/workflows/ci.yml/badge.svg)](https://github.com/expilu/smart-decisions/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/smart-decisions)](https://www.npmjs.com/package/smart-decisions)

A TypeScript library that answers a decision question with a **probability distribution over every option**, using any existing LLM.

To make the decision, you can choose between **[System 1](#system-1-vs-system-2) (fast, instinctive, milliseconds)** or **[System 2](#system-1-vs-system-2) (slow, deliberate, several seconds)** intelligence.

Think of it as a smart `if`.

Where `if` can _only_ branch on a boolean expression, a `choice()` branches on _**meaning**_: you describe a situation (aka _**state**_), the _**options**_ to choose from and _**instructions**_, the library turns that into a _**decision**_, and hands you back the _**per-option probabilities**_.

Its sibling `score()` rates instead of choosing: when the answer is a position on a spectrum (how fast a reply is needed, how warm a lead is, how close a draft is to done) you describe the _**levels**_ of that spectrum and get back a _**score**_ that can land **between two levels**, with the _**per-level probabilities**_.

Its other sibling `noul()` judges instead: when exactly one yes/no proposition is on trial (does this message want a human, does this resume mention distributed systems) you ask it and get back a _**probability**_ — 0..1, the chance the answer is yes — which your code _**thresholds**_.

Ask `choice()` or `score()` and you are also handed the _**confidence**_: how sure it is about the answer. A `noul()` needs none: with only two outcomes, the single probability describes the judgment completely — a value near 0.5 is the "no lean" signal in itself.

Software can then use those _**probabilities**_ and _**confidence**_ to act autonomously (route a request, triage an alert, pick a reply) and to _know when not to act_ (low confidence → fall back to System 2, a human, or another code path).

The library works with any LLM you might already be using, not requiring a dedicated decisions model.

> ⚠️ **Work in progress.**
> Early stage of development.
>
> Only System 1 is implemented today; System 2 is coming.
>
> The API is not final and the complete intended scope of the library is not yet
> fulfilled, expect breaking changes before 1.0.

## Install

```bash
npm install smart-decisions
```

## Usage

```typescript
import { choice } from 'smart-decisions';

const model = {
  apiBaseUrl: 'http://localhost:8000/v1', // your API url. i.e. your llama.cpp server
  apiKey: 'a-super-secret-api-key', // as required or not by your provider
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
};

const answer = await choice({
  model,
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
  criteria: {
    walk: 'Go for a walk',
    movie: 'Watch a movie',
    beach: 'Go to the beach',
  },
});

console.log(answer);
```

`answer` has this shape:

```typescript
{
  choice: 'movie'; // option name with the highest probability
  probabilities: { walk: 0.00081, movie: 0.99913, beach: 0.00006 }; // sums to 1
  confidence: 0.9935; // 0..1 — flat distribution → low, single peak → high
}
```

Notes:

- `mode` defaults to `'system1'`; passing `'system2'` currently throws
  (`Not implemented yet`).
- `confidence` is derived from the distribution shape. See
  [under the hood](https://github.com/expilu/smart-decisions/wiki/Under-the-hood).

`choice()` has two siblings for the other two kinds of answers the library supports. [`score()`](https://github.com/expilu/smart-decisions/wiki/score) rates a position on a spectrum you describe in ordered levels, and [`noul()`](https://github.com/expilu/smart-decisions/wiki/noul) judges a single yes/no question..

The wiki also holds an [examples section](https://github.com/expilu/smart-decisions/wiki/Examples) with longer walkthroughs of specific use cases.

### `choice()` or `score()` or `noul()`?

- A proposition to judge yes/no → [`noul()`](https://github.com/expilu/smart-decisions/wiki/noul).
- Options that are a fixed set with **no order** between them (dept names,
  categories, languages, actions) → [`choice()`](https://github.com/expilu/smart-decisions/wiki/choice).
- A position on a spectrum → [`score()`](https://github.com/expilu/smart-decisions/wiki/score).

## Requirements

- An **OpenAI-compatible v1 API** that supports **`logprobs` / `top_logprobs`** in
  chat completions.

> ⚠️ **Work in progress.**
> Only [llama.cpp](https://github.com/ggml-org/llama.cpp) has been
> tested for now

## Use case

It works with any LLM you already have running. No extra model to deploy.

A **real use case**: you self-host a general-purpose LLM model with llama.cpp and don't have VRAM or RAM left to also serve a specialized decision-making model. Since this tool only needs logprobs from the model you already serve, you reuse it for typed decisions at zero extra footprint.

## System 1 vs System 2

The names come from [dual-process theory](https://en.wikipedia.org/wiki/Dual_process_theory):

- **System 1** is fast, automatic and instinctive. The immediate answer that comes to
  mind. In this library: one single forward pass, one generated token, no reasoning.
  Much cheaper in inference. Usually done in milliseconds range.
- **System 2** is slow, effortful and deliberate — reasoning applied to reach a
  considered verdict. In this library: the LLM reasons and produces a full structured
  response. Slower and more costly. Hopefully more accurate. Usually done in several seconds.

## Performance and cost

System 1 answers are fulfilled with **one single forward pass generating exactly one token**, so
each decision costs next to nothing. Whether you pay in money (a hosted API bills
per token) or in computation (your own server does one quick pass instead of a long
reasoning chain).

On modest hardware it is genuinely fast. Measured locally with my (aging) testing server using
[llama.cpp](https://github.com/ggml-org/llama.cpp) serving
**Qwen3.5-4B Q4_K_M** on an **RTX 2080** (a 2018 card):

- **~360 ms mean** per decision (median).

That includes the whole round trip on the small machine; the library itself adds one
forward pass and one token of generated text to the request (details in
[under the hood](https://github.com/expilu/smart-decisions/wiki/Under-the-hood)). Every decision needs
re-prefill of state + criteria, so latency scales with prompt size. Long criteria
lists will be slower on the same hardware.

## Status

Planned

- [x] System 1 (logit-based)
- [ ] System 2 (LLM structured output, with reasoning / non-reasoning toggle)
- [ ] mode: 'auto'
- [ ] Test and adapt to more inference providers APIs and self hosted engines
- [ ] Benchmarking and model sanity check tools
- [ ] Final API

Perhaps

- [ ] Multi-question batching: evaluating several questions in one request.
- [ ] Option for System 1 using dedicated decision models once the ecosystem (API standards, model behaviours,...) is more stable

## License

[MIT](./LICENSE)
