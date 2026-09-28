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

  it('carries an index signature so engine-specific extras type-check on the body', () => {
    // Extra fields (i.e. merged in from Model['extraBody']) must be representable
    // on the wire type itself, and a plain request must remain assignable to it.
    expectTypeOf<ChatCompletionRequest>().toExtend<Record<string, unknown>>();
    const withExtras: ChatCompletionRequest = {
      model: 'm',
      messages: [],
      reasoning_effort: 'none', // not a declared key; accepted via the index signature
    };
    expectTypeOf(withExtras).not.toBeNever();
  });
});
