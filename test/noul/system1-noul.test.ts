import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system1Noul } from '../../src/noul/system1-noul.js';

// system1Noul is exercised through the global fetch: each mocked response below is a
// real Response carrying a logprobs-shaped body, so tests only need
// `choices[0].logprobs.content[0].top_logprobs` to exist.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

// Running example: an incoming support message judged on "asking for a human
// agent?" — yes maps to Y, no to N, and the answer is the single ratio P(Y).
const question = () => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: 'model',
  },
  state: 'I have asked three times now. Can I please just talk to a real person?',
  instructions: 'Is the customer asking for a human agent?',
});

const logprobToken = (token: string, logprob: number) => ({ token, logprob });
const response = (tops: { token?: unknown; logprob?: unknown }[]) =>
  new Response(JSON.stringify({ choices: [{ logprobs: { content: [{ top_logprobs: tops }] } }] }), {
    status: 200,
  });

describe('system1Noul', () => {
  it('throws when the provider response has no logprobs', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ logprobs: null }] }), { status: 200 }),
    );
    await expect(system1Noul(question())).rejects.toThrow('system1 requires logprobs');
  });

  it('makes a single-token greedy logprobs request', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('y', Math.log(0.57))]));
    await system1Noul(question());

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const params = JSON.parse(init.body as string);
    expect(params.model).toBe('model');
    expect(params.max_tokens).toBe(1); // one forward pass, one generated token
    expect(params.temperature).toBe(0);
    expect(params.logprobs).toBe(true);
    expect(params.top_logprobs).toBe(20);
    expect(params.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(params.stream).toBe(false);
    // Prompt includes the two rendered symbols and the single-letter instruction.
    expect(params.messages[0].content).toContain('Options:');
    expect(params.messages[0].content).toContain('Y: yes');
    expect(params.messages[0].content).toContain('N: no');
    expect(params.messages[0].content).toContain('exactly one letter');
  });

  it('appends the criteria descriptions to the rendered symbols', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('y', Math.log(1.0))]));
    await system1Noul({
      ...question(),
      criteria: {
        true: 'Explicitly asks for a person, agent or human',
        false: 'No sign of wanting a person',
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const params = JSON.parse(init.body as string);
    expect(params.messages[0].content).toContain(
      'Y: yes — Explicitly asks for a person, agent or human',
    );
    expect(params.messages[0].content).toContain('N: no — No sign of wanting a person');
  });

  it('returns the ratio P(yes) from the two-symbol distribution', async () => {
    // 0.57 for a yes spelling, 0.43 for a no spelling → both kept as-is.
    fetchMock.mockResolvedValueOnce(
      response([logprobToken('y', Math.log(0.57)), logprobToken('n', Math.log(0.43))]),
    );
    const answer = await system1Noul(question());
    expect(answer).toEqual({ noul: 0.57 });
  });

  it('groups spelling variants of the same answer into one symbol', async () => {
    // Several yes spellings compete for the Y bucket (the strongest wins; the
    // weaker one must not add up); only one no spelling exists.
    fetchMock.mockResolvedValueOnce(
      response([
        logprobToken(' Y', Math.log(0.5)),
        logprobToken('yes', Math.log(0.45)),
        logprobToken('no', Math.log(0.35)),
      ]),
    );
    const answer = await system1Noul(question());
    expect(answer).toEqual({ noul: 0.5 / 0.85 });
  });

  it('canonicalizes variants across case, spacing and punctuation', async () => {
    fetchMock.mockResolvedValueOnce(
      response([logprobToken('N.', Math.log(0.6)), logprobToken(' Y', Math.log(0.4))]),
    );
    const answer = await system1Noul(question());
    expect(answer).toEqual({ noul: 0.4 });
  });

  it('ignores tokens that spell neither yes nor no', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        logprobToken('true', Math.log(0.4)), // word, but not one of the two families
        logprobToken('1', Math.log(0.3)), // digit → rejected too
        logprobToken('maybe', Math.log(0.2)), // hedging word → rejected
      ]),
    );
    const answer = await system1Noul(question());
    // No candidate symbol in the window → uniform fallback over 2 symbols,
    // so the answer is the exact midpoint 0.5: a visible no-signal answer.
    expect(answer).toEqual({ noul: 0.5 });
  });

  it('returns a strong yes exactly at 1 and a strong no exactly at 0', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('y', Math.log(1.0))]));
    expect(await system1Noul(question())).toEqual({ noul: 1 });

    fetchMock.mockResolvedValueOnce(response([logprobToken('n', Math.log(1.0))]));
    expect(await system1Noul(question())).toEqual({ noul: 0 });
  });

  it('forwards retry and timeout settings to the transport', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    try {
      // maxRetries: 0 → the retryable 500 is not retried, proving forwarding end to end.
      fetchMock.mockResolvedValueOnce(new Response('down', { status: 500 }));
      await expect(
        system1Noul({ ...question(), maxRetries: 0, timeoutMs: 543210 }),
      ).rejects.toThrow('LLM API returned HTTP 500: down');
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(timeoutSpy).toHaveBeenCalledWith(543210);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
