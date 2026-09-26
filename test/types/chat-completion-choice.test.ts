import { describe, expectTypeOf, it } from 'vitest';
import type { ChatCompletionChoice } from '../../src/types/chat-completion-choice.js';
import type { ChatCompletionTokenLogprob } from '../../src/types/chat-completion-token-logprob.js';

// src/types/chat-completion-choice.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('chatCompletionChoice', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<ChatCompletionChoice['logprobs']>().toEqualTypeOf<
      { content?: ChatCompletionTokenLogprob[] | null } | null | undefined
    >();
  });
});
