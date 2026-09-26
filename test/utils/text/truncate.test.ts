import { describe, expect, it } from 'vitest';
import { truncate } from '../../../src/utils/text/truncate.js';

describe('truncate', () => {
  it('keeps short bodies as-is', () => {
    expect(truncate('short', 500)).toBe('short');
  });

  it('keeps bodies exactly at the limit untouched', () => {
    expect(truncate('x'.repeat(500), 500)).toBe('x'.repeat(500));
  });

  it('caps long bodies at the limit with an ellipsis', () => {
    expect(truncate('x'.repeat(501), 500)).toBe(`${'x'.repeat(500)}…`);
    expect(truncate('x'.repeat(600), 500)).toBe(`${'x'.repeat(500)}…`);
  });
});
