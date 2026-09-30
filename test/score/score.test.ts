import { describe, expect, it, vi } from 'vitest';
import { score } from '../../src/index.js';
import { system1Score } from '../../src/score/system1-score.js';
import type { ScoreQuestion } from '../../src/types/score-question.js';
vi.mock('../../src/score/system1-score.js', () => ({
  system1Score: vi.fn().mockResolvedValue({
    score: 1.43,
    probabilities: { '0': 0, '1': 0.57, '2': 0.43 },
    confidence: 0.38,
    legend: { '0': 'a', '1': 'b', '2': 'c' },
  }),
}));

const question = (
  mode?: 'system1' | 'system2',
  criteria: string[] = ['a', 'b'],
): ScoreQuestion => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: 'model',
  },
  // Omitted when undefined: exactOptionalPropertyTypes forbids an explicit `mode: undefined`.
  ...(mode !== undefined && { mode }),
  criteria,
  state: 'state',
  instructions: 'instructions',
});

describe('score', () => {
  it('throws when criteria is not an array', async () => {
    await expect(
      score({ ...question('system1'), criteria: 'ab' as unknown as string[] }),
    ).rejects.toThrow('criteria must be an array of level descriptions');
  });

  it('throws with fewer than 2 levels', async () => {
    await expect(score({ ...question('system1'), criteria: ['only one level'] })).rejects.toThrow(
      'score() supports 2..10 levels, got 1',
    );
  });

  it('throws with more than 10 levels', async () => {
    await expect(
      score({ ...question('system1'), criteria: Array.from({ length: 11 }, (_, i) => `${i}`) }),
    ).rejects.toThrow('score() supports 2..10 levels, got 11');
  });

  it('throws when a level is not a string', async () => {
    const bad = question('system1', ['a', 42 as unknown as string]);
    await expect(score(bad)).rejects.toThrow('criteria[1] must be a string, got number');
  });

  it('delegates system1 mode to system1Score', async () => {
    const answer = await score(question('system1'));
    expect(answer).toEqual({
      score: 1.43,
      probabilities: { '0': 0, '1': 0.57, '2': 0.43 },
      confidence: 0.38,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
    expect(system1Score).toHaveBeenCalledOnce();
  });

  it('defaults mode to system1 when omitted', async () => {
    await expect(score(question(undefined))).resolves.toEqual({
      score: 1.43,
      probabilities: { '0': 0, '1': 0.57, '2': 0.43 },
      confidence: 0.38,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
    expect(system1Score).toHaveBeenCalledOnce();
  });

  it("throws 'Not implemented yet' in system2 mode", async () => {
    await expect(score(question('system2'))).rejects.toThrow('Not implemented yet');
  });

  it("throws 'Unsupported mode' for an unknown mode", async () => {
    const bad = question('nonsense' as unknown as 'system1');
    await expect(score(bad)).rejects.toThrow('Unsupported mode');
  });
});
