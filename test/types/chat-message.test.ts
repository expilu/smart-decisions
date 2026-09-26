import { describe, expectTypeOf, it } from 'vitest';
import type { ChatMessage } from '../../src/types/chat-message.js';

// src/types/chat-message.ts contains only types, so these are compile-time
// assertions: vitest type-checks them with expectTypeOf and the tests pass
// trivially at runtime.
describe('chatMessage', () => {
  it('has the expected fields and optionality', () => {
    expectTypeOf<ChatMessage['role']>().toEqualTypeOf<'system' | 'user' | 'assistant'>();
    expectTypeOf<ChatMessage['content']>().toEqualTypeOf<string>();
  });
});
