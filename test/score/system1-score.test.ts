import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system1Score } from '../../src/score/system1-score.js';

// system1Score is exercised through the global fetch: each mocked response below is a
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

// Running example: an incoming chat message rated on a 3-level reply-urgency
// scale; levels map to digits 0..2, and the answer is a position on that line.
const question = () => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: 'model',
  },
  criteria: ['Whenever is fine, no rush', 'Before the day ends', 'Right now, drop everything'],
  state:
    'Can you hop on a quick call before the 3pm? Legal is asking about the rider we flagged this morning.',
  instructions: 'How fast does this need a reply?',
});

const logprobToken = (token: string, logprob: number) => ({ token, logprob });
const response = (tops: { token?: unknown; logprob?: unknown }[]) =>
  new Response(JSON.stringify({ choices: [{ logprobs: { content: [{ top_logprobs: tops }] } }] }), {
    status: 200,
  });

describe('system1Score', () => {
  it('throws with fewer than 2 levels', async () => {
    await expect(system1Score({ ...question(), criteria: ['only one level'] })).rejects.toThrow(
      'score() supports 2..10 levels, got 1',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws with more than 10 levels', async () => {
    const criteria = Array.from({ length: 11 }, (_, i) => `${i}`);
    await expect(system1Score({ ...question(), criteria })).rejects.toThrow(
      'score() supports 2..10 levels, got 11',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the provider response has no logprobs', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ logprobs: null }] }), { status: 200 }),
    );
    await expect(system1Score(question())).rejects.toThrow('system1 requires logprobs');
  });

  it('makes a single-token greedy logprobs request', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('1', Math.log(0.57))]));
    await system1Score(question());

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
    // Prompt includes the numbered levels and the single-digit instruction.
    expect(params.messages[0].content).toContain('Levels:');
    expect(params.messages[0].content).toContain('0: Whenever is fine, no rush');
    expect(params.messages[0].content).toContain('1: Before the day ends');
    expect(params.messages[0].content).toContain('2: Right now, drop everything');
    expect(params.messages[0].content).toContain('exactly one digit');
  });

  it('returns the expected-value position, probabilities, confidence and legend', async () => {
    // 0.57 on level 1, 0.43 on level 2 → score 1.43.
    fetchMock.mockResolvedValueOnce(
      response([logprobToken(' 1', Math.log(0.57)), logprobToken(' 2', Math.log(0.43))]),
    );
    const answer = await system1Score(question());
    expect(answer.score).toBeCloseTo(1.43, 10); // 0×0 + 1×0.57 + 2×0.43
    expect(answer.probabilities).toEqual({ '0': 0, '1': 0.57, '2': 0.43 });
    expect(answer.legend).toEqual({
      '0': 'Whenever is fine, no rush',
      '1': 'Before the day ends',
      '2': 'Right now, drop everything',
    });
    // Flat-ish distribution between two levels → mid confidence.
    expect(answer.confidence).toBeGreaterThan(0);
    expect(answer.confidence).toBeLessThan(0.5);
  });

  it('scores a certain answer exactly at the level number', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('0', Math.log(1.0))]));
    const answer = await system1Score({ ...question(), criteria: ['low', 'high'] });
    expect(answer.score).toBe(0);
    expect(answer.probabilities).toEqual({ '0': 1, '1': 0 });
    expect(answer.confidence).toBe(1);
  });

  it('ignores non-digit tokens instead of blurring a neighboring level', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        logprobToken('10', Math.log(0.6)), // two-digit token → not a level digit
        logprobToken('1.', Math.log(0.2)), // punctuation variant → rejected too
        logprobToken(' 2', Math.log(0.4)), // spacing variant of digit 2 counts
        logprobToken('blocked', Math.log(0.1)), // words → rejected
      ]),
    );
    const answer = await system1Score(question());
    expect(answer.probabilities).toEqual({ '0': 0, '1': 0, '2': 1 });
    expect(answer.score).toBe(2);
  });

  it('falls back to the spectrum midpoint when no level digit appears', async () => {
    fetchMock.mockResolvedValueOnce(response([logprobToken('A', Math.log(1.0))]));
    const answer = await system1Score(question());
    // No level digit in the window → z === 0 → uniform fallback over 3 levels,
    // so the score is the exact midpoint (0+1+2)/3 = 1 and confidence is 0:
    // a visible, correctly-labeled "no signal" answer.
    expect(answer.probabilities).toEqual({ '0': 1 / 3, '1': 1 / 3, '2': 1 / 3 });
    expect(answer.score).toBe(1);
    expect(answer.confidence).toBeCloseTo(0, 10);
  });

  it('matches confidence to the normalized entropy of the level distribution', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        logprobToken('0', Math.log(0.6)),
        logprobToken('1', Math.log(0.3)),
        logprobToken('2', Math.log(0.1)),
      ]),
    );
    const answer = await system1Score(question());
    // 0.6/0.3/0.1 sums to 1, so normalization is a no-op; confidence = 1 - H/ln(3).
    const conf =
      1 + (0.6 * Math.log(0.6) + 0.3 * Math.log(0.3) + 0.1 * Math.log(0.1)) / Math.log(3);
    expect(answer.confidence).toBeCloseTo(conf, 5);
    expect(answer.score).toBeCloseTo(0.5, 10); // 1×0.3 + 2×0.1
  });

  it('forwards retry and timeout settings to the transport', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    try {
      // maxRetries: 0 → the retryable 500 is not retried, proving forwarding end to end.
      fetchMock.mockResolvedValueOnce(new Response('down', { status: 500 }));
      await expect(
        system1Score({ ...question(), maxRetries: 0, timeoutMs: 543210 }),
      ).rejects.toThrow('LLM API returned HTTP 500: down');
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(timeoutSpy).toHaveBeenCalledWith(543210);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
