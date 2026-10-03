import { describe, expect, it, vi } from 'vitest';
import { noul } from '../../src/index.js';
import { system1Noul } from '../../src/system1/noul.js';
import { system2Noul } from '../../src/system2/noul.js';
import type { NoulCriteria, NoulQuestion } from '../../src/types/noul-question.js';
vi.mock('../../src/system1/noul.js', () => ({
  system1Noul: vi.fn().mockResolvedValue({ noul: 0.57 }),
}));
vi.mock('../../src/system2/noul.js', () => ({
  system2Noul: vi.fn().mockResolvedValue({ noul: 0.02 }),
}));

const question = (
  mode?: 'system1' | 'system2' | 'auto',
  criteria?: NoulCriteria,
): NoulQuestion => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: 'model',
  },
  // Omitted when undefined: exactOptionalPropertyTypes forbids an explicit `mode: undefined`.
  ...(mode !== undefined && { mode }),
  ...(criteria !== undefined && { criteria }),
  state: 'state',
  instructions: 'instructions',
});

describe('noul', () => {
  it('throws when criteria is not an object', async () => {
    await expect(
      noul({ ...question('system1'), criteria: 'yes' as unknown as NoulCriteria }),
    ).rejects.toThrow('criteria must be an object with true/false descriptions');
    expect(system1Noul).not.toHaveBeenCalled();
  });

  it("throws when criteria is null (a JS caller's empty value)", async () => {
    await expect(
      noul({ ...question('system1'), criteria: null as unknown as NoulCriteria }),
    ).rejects.toThrow('criteria must be an object with true/false descriptions');
  });

  it('throws when a criteria description is not a string', async () => {
    const bad = question('system1', {
      true: 'Explicitly time-sensitive',
      false: 42 as unknown as string,
    });
    await expect(noul(bad)).rejects.toThrow('criteria.false must be a string, got number');
  });

  it('throws when the true description is not a string', async () => {
    const bad = question('system1', { true: 42 as unknown as string });
    await expect(noul(bad)).rejects.toThrow('criteria.true must be a string, got number');
  });

  it('delegates system1 mode to system1Noul', async () => {
    const answer = await noul(question('system1'));
    expect(answer).toEqual({ noul: 0.57 });
    expect(system1Noul).toHaveBeenCalledOnce();
  });

  it('defaults mode to system1 when omitted', async () => {
    await expect(noul(question(undefined))).resolves.toEqual({ noul: 0.57 });
    expect(system1Noul).toHaveBeenCalledOnce();
  });

  it('passes the (optional) criteria through to system1Noul', async () => {
    const criteria = { true: 'yes means' };
    await noul(question('system1', criteria));
    expect(system1Noul).toHaveBeenCalledWith(question('system1', criteria));
  });

  it('delegates system2 mode to system2Noul', async () => {
    const before = vi.mocked(system1Noul).mock.calls.length;
    const answer = await noul(question('system2'));
    expect(answer).toEqual({ noul: 0.02 });
    expect(system2Noul).toHaveBeenCalled();
    expect(vi.mocked(system1Noul).mock.calls.length).toBe(before);
  });

  it('escalates a split system1 answer to system2 in auto mode, once', async () => {
    // The noul confidence-equivalent is max(noul, 1 - noul): 0.55 is a split
    // verdict (0.45 confidence-equivalent) → under the 0.7 default it escalates.
    vi.mocked(system1Noul).mockResolvedValueOnce({ noul: 0.55 });
    const answer = await noul(question('auto'));
    expect(system2Noul).toHaveBeenCalled();
    expect(answer).toEqual({ noul: 0.02 }); // the escalated answer, as-is
  });

  it('keeps a leaning system1 answer in auto mode without touching system2', async () => {
    vi.mocked(system2Noul).mockClear();
    vi.mocked(system1Noul).mockResolvedValueOnce({ noul: 0.95 }); // max → 0.95
    const answer = await noul(question('auto'));
    expect(system2Noul).not.toHaveBeenCalled();
    expect(answer).toEqual({ noul: 0.95 });
  });

  it('rejects the System 2-only knobs outside their modes at runtime (JS callers)', async () => {
    await expect(
      noul({ ...question('system1'), thinking: false } as unknown as NoulQuestion),
    ).rejects.toThrow("thinking is only valid when mode is 'system2' or 'auto'");
    await expect(
      noul({ ...question('auto'), thinking: false, autoModeThreshold: 0.9 } as never),
    ).resolves.toEqual({ noul: 0.02 }); // both knobs legal together in 'auto'
    await expect(
      noul({ ...question('system2'), thinking: false, autoModeThreshold: 0.9 } as unknown as never),
    ).rejects.toThrow("autoModeThreshold is only valid in mode 'auto'");
  });

  it("throws 'Unsupported mode' for an unknown mode", async () => {
    const bad = question('nonsense' as unknown as 'system1');
    await expect(noul(bad)).rejects.toThrow('Unsupported mode');
  });
});
