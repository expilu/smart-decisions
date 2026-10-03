---
'smart-decisions': minor
---

Added `mode: 'auto'`: the question runs System 1 first and escalates exactly once to System 2 when the answer's confidence falls below `autoModeThreshold` (default 0.7; for `noul()` the confidence equivalent is `max(noul, 1 − noul)`). The escalated answer is returned as-is even at low confidence — one deliberate pass, never a loop. Confident System 1 answers complete without touching System 2, so the fast path stays in the milliseconds.
