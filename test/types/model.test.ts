import { describe, expectTypeOf, it } from 'vitest';
import type { Model } from '../../src/types/model.js';

// src/types/model.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('model', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<Model['apiBaseUrl']>().toEqualTypeOf<string>();
    expectTypeOf<Model['apiKey']>().toEqualTypeOf<string>();
    expectTypeOf<Model['model']>().toEqualTypeOf<string>();
    expectTypeOf<Model['extraBody']>().toEqualTypeOf<Record<string, unknown> | undefined>();
  });
});
