---
'smart-decisions': minor
---

Added global debug logging: `debug: true` on any question (both modes) logs the internals to stderr — the prompt, the wire request body, the endpoint, raw responses with their HTTP status, every retry with its reason and backoff, and in System 2 the model's reasoning text and each structured-rejection reason.
