import { beforeEach, describe, expect, it, vi } from 'vitest';
import { system1Choice } from '../../src/choice/system1-choice.js';

// Mock the OpenAI client at module level: system1Choice is its direct user.
// All mocked responses below return logprobs-shaped bodies, so tests only need
// `choices[0].logprobs.content[0].top_logprobs` to exist.
const createMock = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

// Running example: "one fruit that stays fresh on the counter for a week".
// The descriptions carry the trade-offs (apple wins, strawberry molds fastest);
// options map to letters A..D.
const question = () => ({
  apiBaseUrl: 'https://example.com/v1',
  apiKey: 'key',
  model: 'model',
  criteria: {
    apple: 'Keeps firm on the counter for a week or more, tastes good on its own',
    banana: 'Cheap and tasty, but ripens to brown in 2-3 days on the counter',
    lemon: 'Lasts a long time, no complaint, but too sour to snack fresh',
    strawberry: 'Delicious, but moldy within a couple of days',
  },
  state: 'I want to buy one fruit that stays fresh on the counter for a whole week.',
  instructions: 'Which fruit should I buy?',
});

const logprobToken = (token: string, logprob: number) => ({ token, logprob });
const response = (tops: { token: string; logprob: number }[]) => ({
  choices: [{ logprobs: { content: [{ top_logprobs: tops }] } }],
});

beforeEach(() => {
  createMock.mockReset();
});

describe('system1Choice', () => {
  it('throws with fewer than 2 options', async () => {
    await expect(
      system1Choice({ ...question(), criteria: { only: 'one option' } }),
    ).rejects.toThrow('choice() supports 2..26 options, got 1');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('throws with more than 26 options', async () => {
    const criteria = Object.fromEntries(Array.from({ length: 27 }, (_, i) => [`opt${i}`, `${i}`]));
    await expect(system1Choice({ ...question(), criteria })).rejects.toThrow(
      'choice() supports 2..26 options, got 27',
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('throws when the provider response has no logprobs', async () => {
    createMock.mockResolvedValueOnce({ choices: [{ logprobs: null }] });
    await expect(system1Choice(question())).rejects.toThrow('system1 requires logprobs');
  });

  it('throws when the provider response has an empty top logprobs list', async () => {
    createMock.mockResolvedValueOnce(response([]));
    await expect(system1Choice(question())).rejects.toThrow('system1 requires logprobs');
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('makes a single-token greedy logprobs request', async () => {
    createMock.mockResolvedValueOnce(response([logprobToken('A', Math.log(0.6))]));
    await system1Choice(question());

    expect(createMock).toHaveBeenCalledOnce();
    const params = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(params.model).toBe('model');
    expect(params.max_tokens).toBe(1); // one forward pass, one generated token
    expect(params.temperature).toBe(0);
    expect(params.logprobs).toBe(true);
    expect(params.top_logprobs).toBe(50);
    expect(params.chat_template_kwargs).toEqual({ enable_thinking: false });
    // Prompt includes the lettered options and the single-letter instruction.
    expect((params.messages as { content: string }[])[0].content).toContain(
      'A: apple — Keeps firm on the counter for a week or more',
    );
    expect((params.messages as { content: string }[])[0].content).toContain('exactly one letter');
  });

  it('groups token variants (case, leading space) and keeps the highest probability', async () => {
    createMock.mockResolvedValueOnce(
      response([
        logprobToken(' A', Math.log(0.3)),
        logprobToken('a', Math.log(0.2)), // same letter, lower → dropped
        logprobToken(' B', Math.log(0.7)),
        logprobToken('!', Math.log(0.05)), // not a letter → ignored
      ]),
    );
    const answer = await system1Choice(question());
    // 0.30000000000000004-style float noise: assert with toBeCloseTo
    expect(answer.probabilities.apple).toBeCloseTo(0.3, 10);
    expect(answer.probabilities.banana).toBeCloseTo(0.7, 10);
    expect(answer.choice).toBe('banana');
  });

  it('normalizes to 1 when letters only account for part of the mass; tie keeps first option', async () => {
    // letters A and B at 0.25 each, another token has 0.5 → z = 0.5, so 0.5/0.5
    createMock.mockResolvedValueOnce(
      response([
        logprobToken('A', Math.log(0.25)),
        logprobToken('B', Math.log(0.25)),
        logprobToken('x', Math.log(0.5)),
      ]),
    );
    const answer = await system1Choice(question());
    expect(answer.probabilities.apple).toBeCloseTo(0.5, 10);
    expect(answer.probabilities.banana).toBeCloseTo(0.5, 10);
    expect(answer.choice).toBe('apple'); // tie → argmax keeps the first
  });

  it('falls back to uniform when no letter appears in the top logprobs', async () => {
    createMock.mockResolvedValueOnce(
      response([logprobToken('2', Math.log(1.0)), logprobToken('!', Math.log(0.5))]),
    );
    const answer = await system1Choice(question());
    // No candidate letter appears, so z === 0 → explicit uniform fallback in the code.
    expect(answer.probabilities).toEqual({
      apple: 0.25,
      banana: 0.25,
      lemon: 0.25,
      strawberry: 0.25,
    });
    expect(answer.confidence).toBeCloseTo(0); // perfectly flat → no confidence
    expect(answer.choice).toBe('apple');
  });

  it('matches confidence to the normalized entropy of the returned distribution', async () => {
    createMock.mockResolvedValueOnce(
      response([
        logprobToken(' A', Math.log(0.6)),
        logprobToken(' B', Math.log(0.2)),
        logprobToken(' C', Math.log(0.15)),
        logprobToken(' D', Math.log(0.05)),
      ]),
    );
    const answer = await system1Choice(question());
    // 0.6/0.2/0.15/0.05 sums to 1, so normalization is a no-op; confidence = 1 - H/ln(4).
    const conf =
      1 +
      (0.6 * Math.log(0.6) + 0.2 * Math.log(0.2) + 0.15 * Math.log(0.15) + 0.05 * Math.log(0.05)) /
        Math.log(4);
    expect(answer.confidence).toBeCloseTo(conf, 5);
    expect(answer.choice).toBe('apple');
  });

  // The argmax reduce can never produce an out-of-range index while `names` comes
  // from Object.entries (a dense array), so the defensive loud failure is unreachable
  // through valid data. Break the invariant from the test side instead: every reduce
  // still runs natively (so normal branches stay exercised), but the argmax — the
  // only reduce whose callback declares (accumulator, value, index) — gets its
  // result overridden with an index beyond `names`.
  it('throws the internal invariant error if the argmax returns an out-of-range index', async () => {
    createMock.mockResolvedValueOnce(response([logprobToken('A', Math.log(0.6))]));
    const native = Array.prototype.reduce;
    const impl = function (
      this: unknown[],
      cb: (acc: unknown, cur: unknown, idx: number) => unknown,
      init: unknown,
    ) {
      const normal = Reflect.apply(native, this, [cb, init]);
      return cb.length === 3 ? this.length + 7 : normal;
    };
    const spy = vi.spyOn(Array.prototype, 'reduce');
    spy.mockImplementation(impl as unknown as typeof Array.prototype.reduce);
    try {
      await expect(system1Choice(question())).rejects.toThrow(
        'internal error: winning option not found at index 11', // 4 options → 4 + 7
      );
    } finally {
      spy.mockRestore();
    }
  });

  // The `?? 0` guards in system1Choice treat nullish probability slots as 0 instead
  // of letting NaN propagate. Such slots can only exist if the invariant
  // "names.map() returns numbers" is broken, so break it from the test side: the
  // map call that builds `probs` (its receiver is an array of strings — the other
  // two map calls receive [name, description] pairs) is hijacked to return an
  // array whose first slot is null. null coerces to 0 in the sum, so execution
  // stays on the normal path while both `?? 0` fallbacks fire.
  it('treats nullish probability slots as 0 instead of letting NaN propagate', async () => {
    createMock.mockResolvedValueOnce(response([logprobToken('B', Math.log(0.4))]));
    const nativeMap = Array.prototype.map;
    const impl = function (this: unknown[], cb: unknown, ...args: unknown[]) {
      // entries.map receivers hold [name, description] pairs → run natively.
      if (Array.isArray(this[0])) return Reflect.apply(nativeMap, this, [cb, ...args]);
      // names.map → the hatch. null coerces to 0 in sums, undefined would not.
      return [null, 0.4, 0.4, 0.2];
    };
    const spy = vi.spyOn(Array.prototype, 'map');
    spy.mockImplementation(impl as unknown as typeof Array.prototype.map);
    try {
      const answer = await system1Choice(question());
      expect(createMock).toHaveBeenCalledOnce();
      // z = null + 0.4 + 0.4 + 0.2 = 1 exactly, so normalization is a no-op;
      // the null slot surfaces as apple: 0 instead of NaN-poisoning the run.
      expect(answer.probabilities).toEqual({ apple: 0, banana: 0.4, lemon: 0.4, strawberry: 0.2 });
      // Argmax: b stays at the null slot until banana's 0.4 beats `probs[b] ?? 0`.
      expect(answer.choice).toBe('banana');
      const conf = 1 + (0.4 * Math.log(0.4) * 2 + 0.2 * Math.log(0.2)) / Math.log(4);
      expect(answer.confidence).toBeCloseTo(conf, 10);
    } finally {
      spy.mockRestore();
    }
  });
});
