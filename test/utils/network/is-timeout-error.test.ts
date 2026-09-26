import { describe, expect, it } from 'vitest';
import { isTimeoutError } from '../../../src/utils/network/is-timeout-error.js';

describe('isTimeoutError', () => {
  it('recognizes AbortSignal.timeout aborts', () => {
    expect(
      isTimeoutError(new DOMException('The operation was aborted due to timeout', 'TimeoutError')),
    ).toBe(true);
  });

  it('rejects other errors and non-Error values', () => {
    expect(isTimeoutError(new Error('fetch failed'))).toBe(false);
    expect(isTimeoutError('boom')).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});
