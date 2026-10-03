import { describe, expectTypeOf, it } from 'vitest';
import type { BaseQuestion } from '../../src/types/base-question.js';
import type { Model } from '../../src/types/model.js';

// src/types/base-question.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('base question', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<BaseQuestion['model']>().toEqualTypeOf<Model>();
    expectTypeOf<BaseQuestion['maxRetries']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BaseQuestion['timeoutMs']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BaseQuestion['debug']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<BaseQuestion['state']>().toEqualTypeOf<string>();
    expectTypeOf<BaseQuestion['instructions']>().toEqualTypeOf<string>();
  });

  it('carries no criteria of its own', () => {
    expectTypeOf<'criteria' extends keyof BaseQuestion ? true : false>().toEqualTypeOf<false>();
  });

  it('carries no mode-dependent fields of its own (they live in the mode partition)', () => {
    expectTypeOf<'mode' extends keyof BaseQuestion ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<'thinking' extends keyof BaseQuestion ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<
      'autoModeThreshold' extends keyof BaseQuestion ? true : false
    >().toEqualTypeOf<false>();
  });
});
