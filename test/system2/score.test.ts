import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system2Score } from '../../src/system2/score.js';

// Score-specific behavior tested against a mocked transport: bounds,
// ratings→level distribution, the shared expected-value position and the
// legend. Engine mechanics live in test/system2/system2.test.ts.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const question = (criteria = ['Whenever is fine', 'Before the day ends', 'Right now']) => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
  },
  state: 'Can you hop on a quick call before the 3pm?',
  instructions: 'How fast does this need a reply?',
  criteria,
});

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('system2Score', () => {
  it('weights level numbers by the ratings share and maps the legend', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"0": 2, "1": 2, "2": 6}'));
    const answer = await system2Score(question());
    // Shares of the mass: level 2 takes 0.6 → lands at 1.2 on the line.
    expect(answer.score).toBeCloseTo(0 * 0.2 + 1 * 0.2 + 2 * 0.6, 10);
    expect(answer.probabilities).toEqual({ '0': 0.2, '1': 0.2, '2': 0.6 });
    expect(answer.legend).toEqual({
      '0': 'Whenever is fine',
      '1': 'Before the day ends',
      '2': 'Right now',
    });
    expect(answer.confidence).toBeGreaterThan(0);
    expect(answer.confidence).toBeLessThan(1);
  });

  it('lands all the probability on one level at the top of the confidence', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"0": 0, "1": 0, "2": 10}'));
    const answer = await system2Score(question());
    expect(answer.score).toBe(2);
    expect(answer.probabilities).toEqual({ '0': 0, '1': 0, '2': 1 });
    expect(answer.confidence).toBe(1);
  });

  it('falls back to the spectrum midpoint when the model rates every level 0', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"0": 0, "1": 0}'));
    const answer = await system2Score(question(['No rush', 'Drop everything']));
    expect(answer.score).toBe(0.5); // uniform over 2 levels
    expect(answer.probabilities).toEqual({ '0': 0.5, '1': 0.5 });
    expect(answer.confidence).toBe(0);
  });

  it('shares the System 1 bounds (2..10 levels), failing fast on direct calls', async () => {
    await expect(system2Score(question(['only one']))).rejects.toThrow(
      'score() supports 2..10 levels, got 1',
    );
    await expect(
      system2Score(question(Array.from({ length: 11 }, (_, i) => `level ${i}`))),
    ).rejects.toThrow('score() supports 2..10 levels, got 11');
  });
});
