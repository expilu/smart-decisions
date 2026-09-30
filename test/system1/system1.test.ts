import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system1Prompt, system1SymbolProbabilities } from '../../src/system1/system1.js';

// The core is exercised through the global fetch: each mocked response below is a
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

const model = { apiBaseUrl: 'https://example.com/v1', apiKey: 'key', model: 'model' };

// A canonicalizer like Score's: only single digits 0..2 are candidates.
const digitCanonicalize = (token: string): string | null => {
  const d = token.trim();
  return d === '0' || d === '1' || d === '2' ? d : null;
};

const question = () => ({
  model,
  state: 'same state',
  instructions: 'same instructions',
  // Extra fields ride along structurally; the core only reads model/transport.
  criteria: { whatever: 'value' },
});

const response = (tops: Array<{ token?: unknown; logprob?: unknown } | null>) =>
  new Response(JSON.stringify({ choices: [{ logprobs: { content: [{ top_logprobs: tops }] } }] }), {
    status: 200,
  });

const logprobToken = (token: string, logprob: number) => ({ token, logprob });

describe('system1Prompt', () => {
  it('renders state, instructions, list and single-symbol instruction', () => {
    const prompt = system1Prompt({
      question: { state: 'The sky is grey and heavy.', instructions: 'Where does this belong?' },
      listLabel: 'Options',
      lines: ['A: walk — Go for a walk', 'B: movie — Watch a movie'],
      answerTerm: 'letter',
      symbols: ['A', 'B'],
    });
    expect(prompt).toBe(
      'The sky is grey and heavy.\n\n' +
        'Where does this belong?\n\n' +
        'Options:\n' +
        'A: walk — Go for a walk\n' +
        'B: movie — Watch a movie\n\n' +
        'Answer with exactly one letter (A, B). ' +
        'Reply with that single letter and nothing else.',
    );
  });

  it('renders a different list label and answer term for other primitives', () => {
    const prompt = system1Prompt({
      question: { state: 'Can you hop on a call before the 3pm?', instructions: 'How fast?' },
      listLabel: 'Levels',
      lines: ['0: Whenever is fine', '1: Right now'],
      answerTerm: 'digit',
      symbols: ['0', '1'],
    });
    expect(prompt).toContain('Levels:\n0: Whenever is fine\n1: Right now\n\n');
    expect(prompt).toContain('Answer with exactly one digit (0, 1). ');
    expect(prompt).toContain('Reply with that single digit and nothing else.');
  });
});

describe('system1SymbolProbabilities', () => {
  it('makes a single-token greedy logprobs request', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('A', Math.log(0.6))]));
    await system1SymbolProbabilities(question(), 'the prompt', ['A', 'B'], (t) =>
      t.trim().toUpperCase(),
    );

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
    expect(params.messages).toEqual([{ role: 'user', content: 'the prompt' }]);
  });

  it('throws when the provider response has no logprobs', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ logprobs: null }] }), { status: 200 }),
    );
    await expect(
      system1SymbolProbabilities(question(), 'p', ['A', 'B'], (t) => t.trim().toUpperCase()),
    ).rejects.toThrow('system1 requires logprobs');
  });

  it('throws when the provider response has an empty top logprobs list', async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    await expect(
      system1SymbolProbabilities(question(), 'p', ['A', 'B'], (t) => t.trim().toUpperCase()),
    ).rejects.toThrow('system1 requires logprobs');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('skips malformed and non-canonical entries, and keeps the max per symbol', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        null, // malformed entry → skipped
        { token: null, logprob: Math.log(0.9) }, // token-less → skipped
        logprobToken(' 1', Math.log(0.3)), // variant of 1
        logprobToken('1', Math.log(0.2)), // same symbol, lower → dropped
        logprobToken('2', Math.log(0.7)),
        logprobToken('x', Math.log(0.5)), // not a candidate → canonicalize → null
      ]),
    );
    // One probability per symbol, aligned to the given order and summing to 1.
    // Float noise on the 0.9999… sum → assert with toBeCloseTo.
    const probs = await system1SymbolProbabilities(
      question(),
      'p',
      ['0', '1', '2'],
      digitCanonicalize,
    );
    expect(probs[0]).toBe(0);
    expect(probs[1]!).toBeCloseTo(0.3, 10);
    expect(probs[2]!).toBeCloseTo(0.7, 10);
  });

  it('normalizes to 1 when symbols only account for part of the mass', async () => {
    fetchMock.mockResolvedValueOnce(
      response([logprobToken('A', Math.log(0.25)), logprobToken('B', Math.log(0.25))]),
    );
    // z = 0.5, so each of A and B becomes 0.5; C never showed up.
    await expect(
      system1SymbolProbabilities(question(), 'p', ['A', 'B', 'C'], (t) => t.trim().toUpperCase()),
    ).resolves.toEqual([0.5, 0.5, 0]);
  });

  it('falls back to uniform when no symbol appears in the top logprobs', async () => {
    fetchMock.mockResolvedValueOnce(
      response([logprobToken('x', Math.log(1.0)), logprobToken('!', Math.log(0.5))]),
    );
    // The digit canonicalizer rejects every entry → z === 0 → explicit uniform fallback.
    const probs = await system1SymbolProbabilities(
      question(),
      'p',
      ['0', '1', '2'],
      digitCanonicalize,
    );
    expect(probs).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('forwards retry and timeout settings to the transport', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    try {
      // maxRetries: 0 → the retryable 500 is not retried, proving forwarding end to end.
      fetchMock.mockResolvedValueOnce(new Response('down', { status: 500 }));
      await expect(
        system1SymbolProbabilities(
          { ...question(), maxRetries: 0, timeoutMs: 424242 },
          'p',
          ['A', 'B'],
          (t) => t.trim().toUpperCase(),
        ),
      ).rejects.toThrow('LLM API returned HTTP 500: down');
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(timeoutSpy).toHaveBeenCalledWith(424242);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
