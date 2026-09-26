import { describe, expectTypeOf, it } from 'vitest';
import type { ChatCompletion } from '../../src/types/chat-completion.js';
import type { ChatCompletionChoice } from '../../src/types/chat-completion-choice.js';

// src/types/chat-completion.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('chatCompletion', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<ChatCompletion['choices']>().toEqualTypeOf<ChatCompletionChoice[]>();
  });
});
