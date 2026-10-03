import { describe, expect, it, vi } from 'vitest';
import { choice } from '../../src/index.js';
import { system1Choice } from '../../src/system1/choice.js';
import { system2Choice } from '../../src/system2/choice.js';
import type { Question } from '../../src/types/question.js';
vi.mock('../../src/system1/choice.js', () => ({
  system1Choice: vi.fn().mockResolvedValue({
    choice: 'mocked',
    probabilities: { a: 1 },
    confidence: 1,
  }),
}));
vi.mock('../../src/system2/choice.js', () => ({
  system2Choice: vi.fn().mockResolvedValue({
    choice: 'deliberated',
    probabilities: { a: 1 },
    confidence: 0.9,
  }),
}));

const question = (
  mode?: 'system1' | 'system2' | 'auto',
  criteria: Record<string, string> = { a: 'A', b: 'B' },
): Question => ({
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

describe('choice', () => {
  it('throws with fewer than 2 options', async () => {
    await expect(
      choice({ ...question('system1'), criteria: { only: 'one option' } }),
    ).rejects.toThrow('choice() supports 2, got 1');
  });

  it('throws when a criteria value is not a string', async () => {
    const bad = question('system1', { a: 42 as unknown as string, b: 'B' });
    await expect(choice(bad)).rejects.toThrow('criteria["a"] must be a string, got number');
  });

  it('delegates system1 mode to system1Choice', async () => {
    const answer = await choice(question('system1'));
    expect(answer).toEqual({ choice: 'mocked', probabilities: { a: 1 }, confidence: 1 });
    expect(system1Choice).toHaveBeenCalledOnce();
  });

  it('defaults mode to system1 when omitted', async () => {
    await expect(choice(question(undefined))).resolves.toEqual({
      choice: 'mocked',
      probabilities: { a: 1 },
      confidence: 1,
    });
    expect(system1Choice).toHaveBeenCalledOnce();
  });

  it('delegates system2 mode to system2Choice', async () => {
    // Earlier tests called system1Choice, so compare counts rather than list
    // contents: System 2 must run, and System 1 must not run again.
    const before = vi.mocked(system1Choice).mock.calls.length;
    const answer = await choice(question('system2'));
    expect(answer).toEqual({ choice: 'deliberated', probabilities: { a: 1 }, confidence: 0.9 });
    expect(system2Choice).toHaveBeenCalled();
    expect(vi.mocked(system1Choice).mock.calls.length).toBe(before);
  });

  it('escalates a low-confidence system1 answer to system2 in auto mode, once', async () => {
    // Queue a low-confidence System 1 answer on top of the default mock.
    vi.mocked(system1Choice).mockResolvedValueOnce({
      choice: 'a',
      probabilities: { a: 1 },
      confidence: 0.3,
    });
    const answer = await choice({
      ...question('auto'),
      criteria: { a: 'A', b: 'B' },
    });
    // The escalated answer is returned as-is, even though its own confidence
    // (0.9) is used for nothing more: one pass of System 2, never a loop.
    expect(system1Choice).toHaveBeenCalledTimes(1);
    expect(system2Choice).toHaveBeenCalledTimes(1);
    expect(answer).toEqual({ choice: 'deliberated', probabilities: { a: 1 }, confidence: 0.9 });
  });

  it('keeps a confident system1 answer in auto mode without touching system2', async () => {
    vi.mocked(system2Choice).mockClear();
    const answer = await choice(question('auto', { a: 'A', b: 'B' }));
    // The default mock holds confidence 1 → no escalation.
    expect(answer).toEqual({ choice: 'mocked', probabilities: { a: 1 }, confidence: 1 });
    expect(system2Choice).not.toHaveBeenCalled();
  });

  it('honors a custom autoModeThreshold and rejects it outside auto mode', async () => {
    // Below-threshold default stays (mock confidence 1 → 1 < 0.95 false):
    const kept = await choice({
      ...question('auto', { a: 'A', b: 'B' }),
      // The mode partition allows the threshold only in 'auto'; the spread
      // needs the assertion for the same reason JS callers do.
      autoModeThreshold: 0.95,
    } as unknown as Question);
    expect(kept).toEqual({ choice: 'mocked', probabilities: { a: 1 }, confidence: 1 });
    // The union type rejects a threshold outside 'auto' at compile time; a JS
    // caller gets the loud runtime error through the router.
    await expect(
      choice({ ...question('system1'), autoModeThreshold: 0.9 } as unknown as Question),
    ).rejects.toThrow("autoModeThreshold is only valid in mode 'auto'");
  });

  it('rejects thinking outside system2/auto modes at runtime (JS callers)', async () => {
    await expect(
      choice({ ...question('system1'), thinking: false } as unknown as Question),
    ).rejects.toThrow("thinking is only valid when mode is 'system2' or 'auto'");
  });

  it("throws 'Unsupported mode' for an unknown mode", async () => {
    const bad = question('nonsense' as unknown as 'system1');
    await expect(choice(bad)).rejects.toThrow('Unsupported mode');
  });
});
