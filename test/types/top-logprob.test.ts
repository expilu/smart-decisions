import { describe, expectTypeOf, it } from 'vitest';
import type { TopLogprob } from '../../src/types/top-logprob.js';

// src/types/top-logprob.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('topLogprob', () => {
  it('has the expected fields', () => {
    expectTypeOf<TopLogprob['token']>().toEqualTypeOf<string>();
    expectTypeOf<TopLogprob['logprob']>().toEqualTypeOf<number>();
  });
});
