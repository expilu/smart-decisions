import { describe, expectTypeOf, it } from 'vitest';
import type { Model } from '../../src/types/model.js';
import type { Mode } from '../../src/types/mode.js';
import type { Question } from '../../src/types/question.js';

// src/types/question.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('question', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<Question['model']>().toEqualTypeOf<Model>();
    expectTypeOf<Question['maxRetries']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Question['timeoutMs']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Question['mode']>().toEqualTypeOf<Mode | undefined>();
    expectTypeOf<Question['state']>().toEqualTypeOf<string>();
    expectTypeOf<Question['instructions']>().toEqualTypeOf<string>();
    expectTypeOf<Question['criteria']>().toEqualTypeOf<Record<string, string>>();
  });
});
