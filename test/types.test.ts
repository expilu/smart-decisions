import { describe, expectTypeOf, it } from 'vitest';
import type { ChoiceAnswer, ChoiceMode, Question } from '../src/types.js';

// src/types.ts contains only types, so these are compile-time assertions: vitest
// type-checks them with expectTypeOf and the tests pass trivially at runtime.
describe('types', () => {
  it('ChoiceMode accepts only system1 and system2', () => {
    expectTypeOf<'system1'>().toExtend<ChoiceMode>();
    expectTypeOf<'system2'>().toExtend<ChoiceMode>();
    expectTypeOf<'system3'>().not.toExtend<ChoiceMode>();
  });

  it('Question has the expected fields and optionality', () => {
    expectTypeOf<Question['apiBaseUrl']>().toEqualTypeOf<string>();
    expectTypeOf<Question['apiKey']>().toEqualTypeOf<string>();
    expectTypeOf<Question['model']>().toEqualTypeOf<string>();
    expectTypeOf<Question['mode']>().toEqualTypeOf<ChoiceMode | undefined>();
    expectTypeOf<Question['state']>().toEqualTypeOf<string>();
    expectTypeOf<Question['instructions']>().toEqualTypeOf<string>();
    expectTypeOf<Question['criteria']>().toEqualTypeOf<Record<string, string>>();
  });

  it('ChoiceAnswer has the expected fields', () => {
    expectTypeOf<ChoiceAnswer['choice']>().toEqualTypeOf<string>();
    expectTypeOf<ChoiceAnswer['probabilities']>().toEqualTypeOf<Record<string, number>>();
    expectTypeOf<ChoiceAnswer['confidence']>().toEqualTypeOf<number>();
  });
});
