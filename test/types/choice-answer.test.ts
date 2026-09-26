import { describe, expectTypeOf, it } from 'vitest';
import type { ChoiceAnswer } from '../../src/types/choice-answer.js';

// src/types/choice-answer.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('choiceAnswer', () => {
  it('has the expected fields', () => {
    expectTypeOf<ChoiceAnswer['choice']>().toEqualTypeOf<string>();
    expectTypeOf<ChoiceAnswer['probabilities']>().toEqualTypeOf<Record<string, number>>();
    expectTypeOf<ChoiceAnswer['confidence']>().toEqualTypeOf<number>();
  });
});
