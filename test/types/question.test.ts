import { describe, expectTypeOf, it } from 'vitest';
import type { ChoiceMode } from '../../src/types/choice-mode.js';
import type { Question } from '../../src/types/question.js';

// src/types/question.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('question', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<Question['apiBaseUrl']>().toEqualTypeOf<string>();
    expectTypeOf<Question['apiKey']>().toEqualTypeOf<string>();
    expectTypeOf<Question['model']>().toEqualTypeOf<string>();
    expectTypeOf<Question['maxRetries']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Question['timeoutMs']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Question['mode']>().toEqualTypeOf<ChoiceMode | undefined>();
    expectTypeOf<Question['state']>().toEqualTypeOf<string>();
    expectTypeOf<Question['instructions']>().toEqualTypeOf<string>();
    expectTypeOf<Question['criteria']>().toEqualTypeOf<Record<string, string>>();
  });
});
