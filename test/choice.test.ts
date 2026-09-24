import { describe, expect, it } from 'vitest';
import { choice } from '../src/index.js';

describe('choice', () => {
  it('returns the placeholder string', () => {
    expect(choice()).toBe('hello world');
  });
});
