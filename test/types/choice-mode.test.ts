import { describe, expectTypeOf, it } from 'vitest';
import type { ChoiceMode } from '../../src/types/choice-mode.js';

// src/types/choice-mode.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('choiceMode', () => {
  it('accepts only system1 and system2', () => {
    expectTypeOf<'system1'>().toExtend<ChoiceMode>();
    expectTypeOf<'system2'>().toExtend<ChoiceMode>();
    expectTypeOf<'system3'>().not.toExtend<ChoiceMode>();
  });
});
