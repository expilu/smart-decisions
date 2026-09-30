---
'smart-decisions': minor
---

feat: shared System 1 core, shared mode router and the `Mode` type

`choice()` System 1 answers are now produced through `src/system1/system1.ts` (the
one-token logprobs engine any System 1 question type reuses) and `src/utils/mode/route-mode.ts`
(the mode router: default to System 1, System 2 answers "Not implemented yet" from a single
stub). New exported types: `Mode` (the shared `'system1' | 'system2'` union) and `BaseQuestion`
(the fields every question type carries — `Question` extends it). No behavior change:
same prompts, same responses, same errors.
