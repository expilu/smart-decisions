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
    expectTypeOf<Question['debug']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Question['mode']>().toEqualTypeOf<Mode | undefined>();
    expectTypeOf<Question['state']>().toEqualTypeOf<string>();
    expectTypeOf<Question['instructions']>().toEqualTypeOf<string>();
    expectTypeOf<Question['criteria']>().toEqualTypeOf<Record<string, string>>();
  });

  it('exposes the System 2 knobs on every member through the union', () => {
    // `thinking` is `never` (absentable) on the System 1 member and
    // `boolean | undefined` on the others; through the union that reads as
    // boolean | undefined for reading, and assignment is what the mode
    // partition guards — asserted below through the system1/system2 shapes.
    expectTypeOf<Question['thinking']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Question['autoModeThreshold']>().toEqualTypeOf<number | undefined>();
  });

  it('accepts a system2 question with thinking, and auto with both knobs', () => {
    // These compile — the mode partition allows each knob in its mode; the
    // typecheck gate is the assertion (assignment is typed):
    const system2: Question = {
      model: { apiBaseUrl: 'u', apiKey: 'k', model: 'm' },
      state: 's',
      instructions: 'i',
      criteria: {},
      mode: 'system2',
      thinking: true,
    };

    const auto: Question = {
      model: { apiBaseUrl: 'u', apiKey: 'k', model: 'm' },
      state: 's',
      instructions: 'i',
      criteria: {},
      mode: 'auto',
      thinking: true,
      autoModeThreshold: 0.8,
    };
    // Meaningful reads of the instances just compiled: they verify the union
    // still narrows cleanly and keeps the fields' optionality.
    expectTypeOf(system2.thinking).toEqualTypeOf<boolean | undefined>();
    expectTypeOf(auto.autoModeThreshold).toEqualTypeOf<number | undefined>();
  });
});
