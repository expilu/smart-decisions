import { describe, expectTypeOf, it } from 'vitest';
import type { Mode } from '../../src/types/mode.js';
import type { ScoreQuestion } from '../../src/types/score-question.js';

// src/types/score-question.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('score question', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<ScoreQuestion['model']>().toEqualTypeOf<
      import('../../src/types/model.js').Model
    >();
    expectTypeOf<ScoreQuestion['maxRetries']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ScoreQuestion['timeoutMs']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ScoreQuestion['mode']>().toEqualTypeOf<Mode | undefined>();
    expectTypeOf<ScoreQuestion['state']>().toEqualTypeOf<string>();
    expectTypeOf<ScoreQuestion['instructions']>().toEqualTypeOf<string>();
    expectTypeOf<ScoreQuestion['criteria']>().toEqualTypeOf<string[]>();
  });
});
