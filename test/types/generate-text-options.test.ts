import { describe, expectTypeOf, it } from 'vitest';
import type { GenerateTextOptions } from '../../src/types/generate-text-options.js';

// src/types/generate-text-options.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('generateTextOptions', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<GenerateTextOptions['maxRetries']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<GenerateTextOptions['timeoutMs']>().toEqualTypeOf<number | undefined>();
  });
});
