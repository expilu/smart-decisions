import { describe, expect, it } from 'vitest';
import { messageOf } from '../../../src/utils/error/message-of.js';

describe('messageOf', () => {
  it('extracts the message from Error instances', () => {
    expect(messageOf(new Error('nope'))).toBe('nope');
  });

  it('stringifies non-Error throwables', () => {
    expect(messageOf('boom')).toBe('boom');
    expect(messageOf(42)).toBe('42');
  });
});
