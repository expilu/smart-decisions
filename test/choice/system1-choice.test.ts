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

// Running example: "It is raining and I am at home. I'm bored." — choose a plan
// for right now (walking or a movie fit a rainy day at home, the beach does not);
// options map to letters A..C.
const question = () => ({
  apiBaseUrl: 'https://example.com/v1',
  apiKey: 'key',
  model: 'model',
  criteria: {
    walk: 'Go for a walk',
    movie: 'Watch a movie',
    beach: 'Go to the beach',
  },
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
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
      'A: walk — Go for a walk',
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
    expect(answer.probabilities.walk).toBeCloseTo(0.3, 10);
    expect(answer.probabilities.movie).toBeCloseTo(0.7, 10);
    expect(answer.choice).toBe('movie');
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
    expect(answer.probabilities.walk).toBeCloseTo(0.5, 10);
    expect(answer.probabilities.movie).toBeCloseTo(0.5, 10);
    expect(answer.choice).toBe('walk'); // tie → argmax keeps the first
  });

  it('falls back to uniform when no letter appears in the top logprobs', async () => {
    createMock.mockResolvedValueOnce(
      response([logprobToken('2', Math.log(1.0)), logprobToken('!', Math.log(0.5))]),
    );
    const answer = await system1Choice(question());
    // No candidate letter appears, so z === 0 → explicit uniform fallback in the code.
    // With 3 options the uniform fallback is exactly 1/3 per option (shared double).
    expect(answer.probabilities).toEqual({ walk: 1 / 3, movie: 1 / 3, beach: 1 / 3 });
    expect(answer.confidence).toBeCloseTo(0); // perfectly flat → no confidence
    expect(answer.choice).toBe('walk');
  });

  it('matches confidence to the normalized entropy of the returned distribution', async () => {
    createMock.mockResolvedValueOnce(
      response([
        logprobToken(' A', Math.log(0.6)),
        logprobToken(' B', Math.log(0.3)),
        logprobToken(' C', Math.log(0.1)),
      ]),
    );
    const answer = await system1Choice(question());
    // 0.6/0.3/0.1 sums to 1, so normalization is a no-op; confidence = 1 - H/ln(3).
    const conf =
      1 + (0.6 * Math.log(0.6) + 0.3 * Math.log(0.3) + 0.1 * Math.log(0.1)) / Math.log(3);
    expect(answer.confidence).toBeCloseTo(conf, 5);
    expect(answer.choice).toBe('walk');
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
        'internal error: winning option not found at index 10', // 3 options → 3 + 7
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
      return [null, 0.6, 0.4];
    };
    const spy = vi.spyOn(Array.prototype, 'map');
    spy.mockImplementation(impl as unknown as typeof Array.prototype.map);
    try {
      const answer = await system1Choice(question());
      expect(createMock).toHaveBeenCalledOnce();
      // z = null + 0.6 + 0.4 = 1 exactly, so normalization is a no-op;
      // the null slot surfaces as walk: 0 instead of NaN-poisoning the run.
      expect(answer.probabilities).toEqual({ walk: 0, movie: 0.6, beach: 0.4 });
      // Argmax: b starts at the null slot until movie's 0.6 beats `probs[b] ?? 0`.
      expect(answer.choice).toBe('movie');
      const conf = 1 + (0.6 * Math.log(0.6) + 0.4 * Math.log(0.4)) / Math.log(3);
      expect(answer.confidence).toBeCloseTo(conf, 10);
    } finally {
      spy.mockRestore();
    }
  });
});
