import { describe, expect, it } from 'vitest';
import { retryDelayFromHeaders } from '../../../src/utils/network/retry-delay-from-headers.js';

describe('retryDelayFromHeaders', () => {
  it('prefers retry-after-ms over retry-after', () => {
    const res = new Response(null, { headers: { 'retry-after-ms': '250', 'retry-after': '9' } });
    expect(retryDelayFromHeaders(res)).toBe(250);
  });

  it('falls back to retry-after seconds', () => {
    const res = new Response(null, { headers: { 'retry-after': '2' } });
    expect(retryDelayFromHeaders(res)).toBe(2000);
  });

  it('returns undefined without retry headers', () => {
    expect(retryDelayFromHeaders(new Response(null))).toBeUndefined();
  });
});
