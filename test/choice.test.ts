import { describe, expect, it, vi } from 'vitest';
import { choice } from '../src/index.js';
import { system1Choice } from '../src/choice/system1-choice.js';
vi.mock('../src/choice/system1-choice.js', () => ({
  system1Choice: vi.fn().mockResolvedValue({
    choice: 'mocked',
    probabilities: { a: 1 },
    confidence: 1,
  }),
}));

const question = (
  mode?: 'system1' | 'system2',
  criteria: Record<string, string> = { a: 'A', b: 'B' },
) => ({
  apiBaseUrl: 'https://example.com/v1',
  apiKey: 'key',
  model: 'model',
  mode,
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

  it("throws 'Not implemented yet' in system2 mode", async () => {
    await expect(choice(question('system2'))).rejects.toThrow('Not implemented yet');
  });

  it("throws 'Unsupported mode' for an unknown mode", async () => {
    const bad = question('nonsense' as unknown as 'system1');
    await expect(choice(bad)).rejects.toThrow('Unsupported mode');
  });
});
