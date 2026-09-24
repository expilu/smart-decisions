# smart-decisions

A TypeScript library that answers a decision question with a **probability
distribution over every option**, using **System 1 (fast, instinctive)** intelligence
— or **System 2 (slow, deliberate, LLM structured
output)** as it grows.

Think of it as a smart `if`: where `if` can only branch on a boolean expression, a
`choice()` branches on _meaning_. You describe a situation and your options, the
library turns it into a decision, and hands you back the per-option probabilities —
not just which branch to take, but how sure it is. Software can use that to act
autonomously (route a request, triage an alert, pick a reply) and to _know when not
to act_ (low confidence → fall back to System 2, a human, or another code path).

## Use case

It works with any LLM you already have running — no extra model to deploy.

A real-world use case: you self-host a general-purpose model with llama.cpp
and don't have VRAM left to also serve a specialized
decision-making model. Since this tool only needs logprobs from the model you
already serve, you reuse it for typed decisions at zero extra footprint.

## System 1 vs System 2

The names come from [dual-process theory](https://en.wikipedia.org/wiki/Dual_process_theory)
(Daniel Kahneman's _Thinking, Fast and Slow_):

- **System 1** is fast, automatic and instinctive. The immediate answer that comes to
  mind. In this library: one forward pass, one generated token, no reasoning.
  Much cheaper in inference.
- **System 2** is slow, effortful and deliberate — reasoning applied to reach a
  considered verdict. In this library: the LLM reasons and produces a full structured
  response. Slower and more costly.

> ⚠️ **Work in progress.** Only System 1 is implemented today; System 2 is coming.
> The API is not final and the complete intended scope of the library is not yet
> fulfilled — expect breaking changes before 1.0.

## Install

```bash
npm install smart-decisions
```

## Requirements

- **Node >= 22**
- An **OpenAI-compatible v1 API** that supports **`logprobs` / `top_logprobs`** in
  chat completions. Only [llama.cpp](https://github.com/ggml-org/llama.cpp) has been
  tested for now — other OpenAI-compatible servers (vLLM, LM Studio, Ollama, …)
  should keep working as long as they return logprobs, but are unverified yet.

## Usage

```typescript
import { choice } from 'smart-decisions';

const answer = await choice({
  apiBaseUrl: 'http://localhost:8000/v1', // your API url. i.e. your llama.cpp server
  apiKey: 'not-needed', // as required or not by your provider
  model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
  state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
  instructions: 'Which fruit should I buy?',
  criteria: {
    apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
    banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
    lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
    strawberry: 'Delicious, but moldy within a couple of days',
  },
});

console.log(answer);
```

`answer` has this shape:

```typescript
{
  choice: 'apple'; // option name with the highest probability
  probabilities: { apple: 0.999, banana: 0.001, lemon: 0.0007, strawberry: 0.00002 }; // sums to 1
  confidence: 0.994; // 0..1 — flat distribution → low, single peak → high
}
```

Notes:

- `mode` defaults to `'system1'`; passing `mode: 'system2'` currently throws
  (`Not implemented yet`).
- Supports **2 to 26 options** (see [under the hood](#how-it-works-under-the-hood))
- `confidence` is derived from the distribution shape — see
  [under the hood](#how-it-works-under-the-hood) for the exact formula.

## Performance

System 1 answers with **one single forward pass generating exactly one token**, so
each decision costs next to nothing — whether you pay in money (a hosted API bills
per token) or in computation (your own server does one quick pass instead of a long
reasoning chain).

On modest hardware it is genuinely fast. Measured locally with
[llama.cpp](https://github.com/ggml-org/llama.cpp) serving
**Qwen3.5-4B Q4_K_M** on an **RTX 2080** (a 2018 card):

- **~360 ms mean** per decision (median).

That includes the whole round trip on the small machine; the library itself adds one
forward pass and one token of generated text to the request (details in
[under the hood](#how-it-works-under-the-hood)). Every decision needs
re-prefill of state + criteria, so latency scales with prompt size — long criteria
lists (up to 26 options) will be slower on the same hardware.

## How it works under the hood

The key trick: an LLM always computes a **probability distribution over all possible
tokens** before it answers — we just need the right request to _receive_ that
distribution. That's only guaranteed with an actual generation, so we ask for one with just one token, but **the generated token itself is irrelevant and gets discarded**. What matters is the letter logits that make up the probability distribution over our options.

System 1 asks the model a single question and reads the logprobs of the answer's
first (and only) generated token:

1. Each option (`criteria` key) is assigned a letter of the alphabet (2–26 options,
   one per letter) and rendered in the prompt as `A: name — description`.
2. The request is tuned to make the answer itself be exactly one letter —
   deterministic and cheap:
   - `max_tokens: 1` (the answer is a single letter)
   - `temperature: 0` (greedy: always the most likely letter)
   - `top_logprobs: 50` (wide enough window that every declared letter — and its token variants — lands in the report)
   - thinking-reasoning disabled (avoid wasting this one token on a think tag)
3. What we read is not the answer text itself (it is thrown away): the winning
   option is whichever letter carried the highest generated probability. The
   report declares all candidate letters; each letter appears as token variants
   (case, leading space, BOS…) — the highest probability among them wins.
4. Letter probabilities are normalized into the `probabilities` map (sums to 1);
   the option letters never showing up fall back to a uniform distribution
   (no signal instead of a fake confident answer).
5. `confidence` summarizes how decisive the answer is: if the probability is spread
   evenly across the options (the model has no clear instinct), it stays near 0;
   the more the probability piles up on one option, the closer it gets to 1.

## Status

- [x] System 1 (logit-based)
- [ ] System 2 (LLM structured output, with reasoning / non-reasoning toggle)
- [ ] OpenAI / Gemini / Openrouter/ vLLM / LM Studio / Ollama APIs verification (found working only with llama.cpp)
- [ ] Final API

## License

[MIT NON-AI License](./LICENSE) — free to use, not to redistribute on model training data.
