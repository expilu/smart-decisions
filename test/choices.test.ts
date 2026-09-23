import { describe, expect, it } from 'vitest';
import { choices } from '../src/index.js';

describe('choices', () => {
  it('returns the placeholder string', () => {
    expect(choices()).toBe('hello world');
  });
});
