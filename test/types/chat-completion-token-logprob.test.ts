import { describe, expectTypeOf, it } from 'vitest';
import type { ChatCompletionTokenLogprob } from '../../src/types/chat-completion-token-logprob.js';
import type { TopLogprob } from '../../src/types/top-logprob.js';

// src/types/chat-completion-token-logprob.ts contains only types, so these are
// compile-time assertions: vitest type-checks them with expectTypeOf and the tests
// pass trivially at runtime.
describe('chatCompletionTokenLogprob', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<ChatCompletionTokenLogprob['token']>().toEqualTypeOf<string>();
    expectTypeOf<ChatCompletionTokenLogprob['logprob']>().toEqualTypeOf<number>();
    expectTypeOf<ChatCompletionTokenLogprob['top_logprobs']>().toEqualTypeOf<
      TopLogprob[] | undefined
    >();
  });
});
