import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system2Choice } from '../../src/system2/choice.js';

// The primitive minus the transport: the global fetch carries structured
// replies, the engine's parsing/schema behavior is covered in
// test/system2/system2.test.ts. What is here is Choice-specific: bounds,
// ratings→distribution conversion, argmax and the entropy confidence.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const question = (
  criteria: Record<string, string> = { walk: 'Go for a walk', movie: 'Watch a movie' },
) => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
  },
  state: "It is raining and I am at home. I'm bored.",
  instructions: 'Give me a good plan to do now',
  criteria,
});

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('system2Choice', () => {
  it('converts the ratings into the distribution and argmaxes the winner', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 8, "movie": 2, "beach": 0}'));
    const answer = await system2Choice(
      question({ walk: 'Go for a walk', movie: 'Watch a movie', beach: 'Go to the beach' }),
    );
    expect(answer.choice).toBe('walk');
    expect(answer.probabilities).toEqual({ walk: 0.8, movie: 0.2, beach: 0 });
    // Entropy over {0.8, 0.2, 0}: a clear peak, but not a certainty.
    expect(answer.confidence).toBeGreaterThan(0);
    expect(answer.confidence).toBeLessThan(1);
  });

  it('returns every rating as a probability ratio, all-zero reading as uniform', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 0, "movie": 0}'));
    const answer = await system2Choice(question());
    expect(answer.choice).toBe('walk'); // tie → first in the user's order
    expect(answer.probabilities).toEqual({ walk: 0.5, movie: 0.5 });
    expect(answer.confidence).toBe(0); // uniform → no confidence signal
  });

  it('keeps the ratings order independent of reply order', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"movie": 9, "walk": 1}'));
    const answer = await system2Choice(question());
    expect(answer.choice).toBe('movie');
    expect(answer.probabilities).toEqual({ walk: 0.1, movie: 0.9 });
  });

  it('throws with fewer than 2 options so direct calls stay safe', async () => {
    await expect(system2Choice(question({ only: 'one option' }))).rejects.toThrow(
      'choice() supports 2 or more options, got 1',
    );
  });

  it('lets a deliberate 0 rating speak, unlike a missing symbol in System 1', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 0, "movie": 5}'));
    const answer = await system2Choice(question());
    expect(answer).toEqual({
      choice: 'movie',
      probabilities: { walk: 0, movie: 1 },
      confidence: 1,
    });
  });

  // The argmax reduce can never produce an out-of-range index while names comes
  // from Object.entries, so the defensive loud failure is unreachable through
  // valid data. Same technique as the System 1 twin: run every reduce natively,
  // but override the argmax's (3-arg) result with an index beyond names.
  it('throws the internal invariant error if the argmax returns an out-of-range index', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}'));
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
      await expect(system2Choice(question())).rejects.toThrow(
        'internal error: winning option not found at index 9', // 2 options → 2 + 7
      );
    } finally {
      spy.mockRestore();
    }
  });
});
