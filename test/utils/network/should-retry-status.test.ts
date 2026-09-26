import { describe, expect, it } from 'vitest';
import { shouldRetryStatus } from '../../../src/utils/network/should-retry-status.js';

describe('shouldRetryStatus', () => {
  it('obeys x-should-retry when present, both ways', () => {
    expect(
      shouldRetryStatus(new Response(null, { status: 400, headers: { 'x-should-retry': 'true' } })),
    ).toBe(true);
    expect(
      shouldRetryStatus(
        new Response(null, { status: 500, headers: { 'x-should-retry': 'false' } }),
      ),
    ).toBe(false);
  });

  it('retries timeouts, lock timeouts, rate limits and any 5xx', () => {
    for (const status of [408, 409, 429, 500, 503, 599]) {
      expect(shouldRetryStatus(new Response(null, { status }))).toBe(true);
    }
  });

  it('does not retry other statuses', () => {
    for (const status of [200, 301, 400, 401, 404, 418, 499]) {
      expect(shouldRetryStatus(new Response(null, { status }))).toBe(false);
    }
  });
});
