import { describe, expect, it, vi } from 'vitest';
import { routeMode } from '../../../src/utils/mode/route-mode.js';

describe('routeMode', () => {
  it("runs the system1 handler for 'system1'", async () => {
    const system1 = vi.fn().mockResolvedValue('answer');
    await expect(routeMode('system1', system1)).resolves.toBe('answer');
    expect(system1).toHaveBeenCalledOnce();
  });

  it('defaults an undefined mode to system1', async () => {
    const system1 = vi.fn().mockResolvedValue('defaulted');
    await expect(routeMode(undefined, system1)).resolves.toBe('defaulted');
    expect(system1).toHaveBeenCalledOnce();
  });

  it("throws 'Not implemented yet' for 'system2' without calling the handler", async () => {
    const system1 = vi.fn();
    await expect(routeMode('system2', system1)).rejects.toThrow('Not implemented yet');
    // The System 1 handler must not run for a question that asked for System 2.
    expect(system1).not.toHaveBeenCalled();
  });

  it("throws 'Unsupported mode' for anything else", async () => {
    const system1 = vi.fn();
    await expect(
      // A JS caller can pass a value outside the Mode union at runtime.
      routeMode('system3' as unknown as undefined, system1),
    ).rejects.toThrow('Unsupported mode');
    expect(system1).not.toHaveBeenCalled();
  });
});
