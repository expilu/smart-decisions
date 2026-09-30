import { describe, expectTypeOf, it } from 'vitest';
import type { Mode } from '../../src/types/mode.js';

// src/types/mode.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('mode', () => {
  it('accepts only system1 and system2', () => {
    expectTypeOf<'system1'>().toExtend<Mode>();
    expectTypeOf<'system2'>().toExtend<Mode>();
    expectTypeOf<'system3'>().not.toExtend<Mode>();
  });

  it('narrows into its two members after assignment', () => {
    expectTypeOf<Mode>().toEqualTypeOf<'system1' | 'system2'>();
  });
});
