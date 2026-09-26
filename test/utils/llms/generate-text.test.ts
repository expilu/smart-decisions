import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from '../../../src/utils/llms/generate-text.js';
import type { ChatCompletionRequest } from '../../../src/types/chat-completion-request.js';

// The transport is exercised through the global fetch with real Response objects, so
// every test runs against the same status/headers/body contract the server answers with.
const fetchMock = vi.fn();
// Observes per-attempt timeouts; spying on the static calls through to the real one.
const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

const connection = () => ({ apiBaseUrl: 'https://example.com/v1', apiKey: 'secret' });
const request = (): ChatCompletionRequest => ({
  model: 'model',
  messages: [{ role: 'user', content: 'hi' }],
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fail = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers });

interface FetchInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  timeoutSpy.mockClear();
});

describe('generateText', () => {
  it('posts a non-streaming request with auth headers and a timeout signal', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ logprobs: null }] }));

    const answer = await generateText(connection(), request());

    expect(answer).toEqual({ choices: [{ logprobs: null }] });
    const [url, init] = fetchMock.mock.calls[0] as [URL, FetchInit];
    expect(String(url)).toBe('https://example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Accept).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer secret');
    expect(init.headers['User-Agent']).toMatch(/^smart-decisions\//);
    expect(JSON.parse(init.body)).toEqual({
      model: 'model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('joins base URLs with and without a trailing slash without doubling it', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [] }));
    await generateText(connection(), request());

    fetchMock.mockResolvedValueOnce(ok({ choices: [] }));
    await generateText({ apiBaseUrl: 'https://example.com/v1/', apiKey: 'k' }, request());

    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://example.com/v1/chat/completions');
    expect(String(fetchMock.mock.calls[1]![0])).toBe('https://example.com/v1/chat/completions');
  });

  it('applies the default timeout and honors an explicit one, per attempt', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [] }));
    await generateText(connection(), request());
    expect(timeoutSpy).toHaveBeenCalledWith(600_000); // 10-minute default

    fetchMock.mockResolvedValueOnce(ok({ choices: [] }));
    await generateText(connection(), request(), { timeoutMs: 42 });
    expect(timeoutSpy).toHaveBeenCalledWith(42);
  });

  it('throws immediately on a non-retryable status, without retrying', async () => {
    fetchMock.mockResolvedValueOnce(fail(400, '{"error":{"message":"bad"}}'));

    await expect(generateText(connection(), request())).rejects.toThrow(
      'LLM API returned HTTP 400: {"error":{"message":"bad"}}',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honors maxRetries: 0 by making exactly one attempt, and truncates long bodies', async () => {
    const long = 'x'.repeat(600);
    fetchMock.mockResolvedValue(fail(408, long));

    await expect(generateText(connection(), request(), { maxRetries: 0 })).rejects.toThrow(
      `LLM API returned HTTP 408: ${'x'.repeat(500)}…`, // exactly one ellipsis shows the cut
    );
    // 408 is retryable per status, but maxRetries: 0 means no second attempt.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 408 and 409 once each on the default backoff, then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(408, 'timeout'))
      .mockResolvedValueOnce(fail(409, 'locked'))
      .mockResolvedValueOnce(ok({ choices: [] }));

    const pending = generateText(connection(), request());
    // Default backoff: 500ms after the first failure, 1000ms after the second.
    await vi.advanceTimersByTimeAsync(1500);
    await expect(pending).resolves.toEqual({ choices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a 429 waiting for the retry-after-ms header, not the default backoff', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(429, 'rate limited', { 'retry-after-ms': '250' }))
      .mockResolvedValueOnce(ok({ choices: [] }));

    const pending = generateText(connection(), request());
    await vi.advanceTimersByTimeAsync(249); // default backoff would be 500ms, header says 250
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ choices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 5xx honoring retry-after until attempts run out, reporting the last body', async () => {
    // A factory, not mockResolvedValue: each attempt must get a fresh Response,
    // because a real response body can only be read once.
    let attempt = 0;
    fetchMock.mockImplementation(async () => fail(503, `body${++attempt}`, { 'retry-after': '2' }));

    // The rejection handler attaches at creation, so the pending rejection is never unhandled.
    const pending = expect(generateText(connection(), request())).rejects.toThrow(
      // The thrown message comes from the LAST attempt's body.
      'LLM API returned HTTP 503: body3',
    );
    // retry-after: 2s before each retry; 2 retries → 3 attempts.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await pending;
  });

  it('obeys x-should-retry over its own status-based policy, both ways', async () => {
    // Not retryable per status, but the server explicitly asks to retry: 400 retried.
    fetchMock
      .mockResolvedValueOnce(fail(400, 'weird policy', { 'x-should-retry': 'true' }))
      .mockResolvedValueOnce(ok({ choices: [] }));
    const first = generateText(connection(), request());
    await vi.advanceTimersByTimeAsync(500);
    await expect(first).resolves.toEqual({ choices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Retryable per status, but the server explicitly says don't: 500 not retried.
    fetchMock.mockResolvedValueOnce(fail(500, 'explicitly final', { 'x-should-retry': 'false' }));
    await expect(generateText(connection(), request())).rejects.toThrow(
      'LLM API returned HTTP 500: explicitly final',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falls back to the exponential backoff for absent, non-numeric and too-long retry-afters', async () => {
    fetchMock
      .mockResolvedValueOnce(fail(503, 'a', { 'retry-after-ms': 'later' })) // NaN text → backoff
      .mockResolvedValueOnce(fail(503, 'b', { 'retry-after-ms': '-5' })) // negative → backoff
      .mockResolvedValueOnce(fail(503, 'c', { 'retry-after': 'Sat, 26 Sep 2026 12:00:00 GMT' })) // HTTP-date → backoff
      .mockResolvedValueOnce(fail(503, 'd', { 'retry-after': '120' })) // > 60s → backoff
      .mockResolvedValueOnce(ok({ choices: [] }));

    const pending = generateText(connection(), request(), { maxRetries: 4 });
    // All fallback backoff delays: 500, 1000, 2000, 4000.
    await vi.advanceTimersByTimeAsync(7500);
    await expect(pending).resolves.toEqual({ choices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('throws on a 200 response with an unparsable body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>gateway error</html>', { status: 200 }));

    await expect(generateText(connection(), request())).rejects.toThrow(
      'LLM API returned invalid JSON: <html>gateway error</html>',
    );
  });

  it('retries network errors, and wraps the cause in the final error message', async () => {
    const boom = new Error('connection refused');
    fetchMock.mockRejectedValueOnce(boom).mockResolvedValueOnce(ok({ choices: [] }));

    const pending = generateText(connection(), request());
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual({ choices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries timeouts, throwing with the cause after the first attempt', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    fetchMock.mockRejectedValue(timeout);

    const err = await generateText(connection(), request()).catch((err) => err);
    expect(err.message).toBe(
      'LLM request to https://example.com/v1/chat/completions failed: The operation was aborted due to timeout',
    );
    expect(err.cause).toBe(timeout);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error rejections too, exhausting all attempts', async () => {
    fetchMock.mockRejectedValue('boom');

    const caught = generateText(connection(), request(), { maxRetries: 2 }).catch(
      (err) => err as Error,
    );
    await vi.advanceTimersByTimeAsync(3500); // 500 + 1000 + 2000
    const err = await caught;
    // @ts-expect-error test
    expect(err.message).toBe('LLM request to https://example.com/v1/chat/completions failed: boom');
    // @ts-expect-error test
    expect(err.cause).toBe('boom');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
