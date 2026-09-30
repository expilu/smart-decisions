---
'smart-decisions': minor
---

feat: `score()` — rate a position on a spectrum

New `score()` primitive for decisions that are a position on a scale of ordered,
described levels: its answer is a `score` (the probability-weighted mean of the
level numbers, so it can fall between two levels), the per-level `probabilities`
and `legend` keyed by level number as string, and the usual 0..1 `confidence`.
Accepts 2..10 level descriptions in `criteria` (an ordered array, low end of the
scale first); one dimension per question is recommended. Not implemented yet in System 2 mode.
