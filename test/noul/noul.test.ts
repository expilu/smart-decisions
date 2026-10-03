import { describe, expect, it, vi } from 'vitest';
import { noul } from '../../src/index.js';
import { system1Noul } from '../../src/system1/noul.js';
import type { NoulCriteria, NoulQuestion } from '../../src/types/noul-question.js';
vi.mock('../../src/system1/noul.js', () => ({
  system1Noul: vi.fn().mockResolvedValue({ noul: 0.57 }),
}));

const question = (mode?: 'system1' | 'system2', criteria?: NoulCriteria): NoulQuestion => ({
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

  it("throws 'Not implemented yet' in system2 mode", async () => {
    await expect(noul(question('system2'))).rejects.toThrow('Not implemented yet');
  });

  it("throws 'Unsupported mode' for an unknown mode", async () => {
    const bad = question('nonsense' as unknown as 'system1');
    await expect(noul(bad)).rejects.toThrow('Unsupported mode');
  });
});
