import { describe, expectTypeOf, it } from 'vitest';
import type { ScoreAnswer } from '../../src/types/score-answer.js';

// src/types/score-answer.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('score answer', () => {
  it('has the expected fields and types', () => {
    expectTypeOf<ScoreAnswer['score']>().toEqualTypeOf<number>();
    expectTypeOf<ScoreAnswer['probabilities']>().toEqualTypeOf<Record<string, number>>();
    expectTypeOf<ScoreAnswer['confidence']>().toEqualTypeOf<number>();
    expectTypeOf<ScoreAnswer['legend']>().toEqualTypeOf<Record<string, string>>();
  });
});
