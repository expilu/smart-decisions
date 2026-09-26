import { describe, expectTypeOf, it } from 'vitest';
import type { ChatCompletionRequest } from '../../src/types/chat-completion-request.js';

// src/types/chat-completion-request.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('chatCompletionRequest', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<ChatCompletionRequest['model']>().toEqualTypeOf<string>();
    expectTypeOf<ChatCompletionRequest['messages']>().toEqualTypeOf<
      import('../../src/types/chat-message.js').ChatMessage[]
    >();
    expectTypeOf<ChatCompletionRequest['max_tokens']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ChatCompletionRequest['temperature']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ChatCompletionRequest['logprobs']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ChatCompletionRequest['top_logprobs']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ChatCompletionRequest['chat_template_kwargs']>().toEqualTypeOf<
      Record<string, unknown> | undefined
    >();
  });
});
