import { describe, expect, it, vi } from 'vitest';
import { score } from '../../src/index.js';
import { system1Score } from '../../src/system1/score.js';
import { system2Score } from '../../src/system2/score.js';
import type { ScoreQuestion } from '../../src/types/score-question.js';
vi.mock('../../src/system1/score.js', () => ({
  system1Score: vi.fn().mockResolvedValue({
    score: 1.43,
    probabilities: { '0': 0, '1': 0.57, '2': 0.43 },
    confidence: 0.38,
    legend: { '0': 'a', '1': 'b', '2': 'c' },
  }),
}));
vi.mock('../../src/system2/score.js', () => ({
  system2Score: vi.fn().mockResolvedValue({
    score: 2,
    probabilities: { '0': 0, '1': 0, '2': 1 },
    confidence: 1,
    legend: { '0': 'a', '1': 'b', '2': 'c' },
  }),
}));

const question = (
  mode?: 'system1' | 'system2' | 'auto',
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

  it('delegates system2 mode to system2Score', async () => {
    const before = vi.mocked(system1Score).mock.calls.length;
    const answer = await score(question('system2'));
    expect(answer).toEqual({
      score: 2,
      probabilities: { '0': 0, '1': 0, '2': 1 },
      confidence: 1,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
    expect(system2Score).toHaveBeenCalled();
    expect(vi.mocked(system1Score).mock.calls.length).toBe(before);
  });

  it('escalates a low-confidence system1 answer to system2 in auto mode, once', async () => {
    vi.mocked(system1Score).mockResolvedValueOnce({
      score: 1.43,
      probabilities: { '0': 0, '1': 0.57, '2': 0.43 },
      confidence: 0.2,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
    const answer = await score(question('auto', ['a', 'b']));
    expect(vi.mocked(system1Score).mock.calls.length).toBeGreaterThan(0);
    expect(system2Score).toHaveBeenCalled();
    // The escalated System 2 answer is returned as-is.
    expect(answer).toEqual({
      score: 2,
      probabilities: { '0': 0, '1': 0, '2': 1 },
      confidence: 1,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
  });

  it('keeps a confident system1 answer in auto mode without touching system2', async () => {
    vi.mocked(system2Score).mockClear();
    vi.mocked(system1Score).mockResolvedValueOnce({
      score: 1.9,
      probabilities: { '0': 0, '1': 0, '2': 1 },
      confidence: 0.95,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
    const answer = await score(question('auto', ['a', 'b']));
    expect(system2Score).not.toHaveBeenCalled();
    expect(answer).toEqual({
      score: 1.9,
      probabilities: { '0': 0, '1': 0, '2': 1 },
      confidence: 0.95,
      legend: { '0': 'a', '1': 'b', '2': 'c' },
    });
  });

  it('honors a custom autoModeThreshold and rejects it outside auto mode', async () => {
    // The default mock rides confidence 0.38: under a 0.3 threshold no
    // escalation happens; under 'system2' the threshold itself throws.
    const answer = await score({
      ...question('auto', ['a', 'b']),
      autoModeThreshold: 0.3,
    } as unknown as ScoreQuestion);
    expect(answer.score).toBe(1.43); // the default System 1 mock answer
    await expect(
      score({ ...question('system1', ['a', 'b']), autoModeThreshold: 0.3 } as unknown as never),
    ).rejects.toThrow("autoModeThreshold is only valid in mode 'auto'");
  });

  it('rejects thinking outside system2/auto modes at runtime (JS callers)', async () => {
    await expect(
      score({ ...question('system1', ['a', 'b']), thinking: false } as unknown as never),
    ).rejects.toThrow("thinking is only valid when mode is 'system2' or 'auto'");
  });

  it("throws 'Unsupported mode' for an unknown mode", async () => {
    const bad = question('nonsense' as unknown as 'system1');
    await expect(score(bad)).rejects.toThrow('Unsupported mode');
  });
});
