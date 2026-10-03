import { describe, expect, it, vi } from 'vitest';
import { routeMode } from '../../../src/utils/mode/route-mode.js';

// routeMode reads only the mode-dependent fields; TypeScript callers get them
// rejected at compile time by the mode-partitioned union, so these tests build
// the wider runtime objects JS callers would pass.
type Routed = Parameters<typeof routeMode>[0];

describe('routeMode', () => {
  describe('dispatch', () => {
    it("runs the system1 handler for 'system1'", async () => {
      const system1 = vi.fn().mockResolvedValue('answer');
      await expect(routeMode({ mode: 'system1' }, { system1 })).resolves.toBe('answer');
      expect(system1).toHaveBeenCalledOnce();
    });

    it('defaults an undefined mode to system1', async () => {
      const system1 = vi.fn().mockResolvedValue('defaulted');
      // No `mode` key at all: exactOptionalPropertyTypes forbids the explicit undefined.
      await expect(routeMode({}, { system1 })).resolves.toBe('defaulted');
      expect(system1).toHaveBeenCalledOnce();
    });

    it("throws 'Not implemented yet' for 'system2' while no system2 handler exists, without running System 1", async () => {
      const system1 = vi.fn();
      await expect(routeMode({ mode: 'system2' }, { system1 })).rejects.toThrow(
        'Not implemented yet',
      );
      expect(system1).not.toHaveBeenCalled();
    });

    it('runs the system2 handler once the question type implements it', async () => {
      const system2 = vi.fn().mockResolvedValue('deliberated');
      await expect(routeMode({ mode: 'system2' }, { system1: vi.fn(), system2 })).resolves.toBe(
        'deliberated',
      );
      expect(system2).toHaveBeenCalledOnce();
    });

    it("throws 'Not implemented yet' for 'auto' while no system2 handler exists, after System 1 ran", async () => {
      const system1 = vi.fn().mockResolvedValue('gut-answer');
      // 'auto' means System 1 first, always; the dead-end hits when the code
      // cannot say the answer was confident (no confidence extractor yet) or
      // when an actually-needed escalation finds no System 2 handler. Becomes
      // live once System 2 lands.
      await expect(routeMode({ mode: 'auto' }, { system1 })).rejects.toThrow('Not implemented yet');
      expect(system1).toHaveBeenCalledOnce();
      // Same dead-end with the extractor present but the handler missing: a
      // low-confidence System 1 answer needs the escalation that isn't there.
      await expect(
        routeMode(
          { mode: 'auto' },
          { system1: vi.fn().mockResolvedValue('low'), confidence: () => 0.1 },
        ),
      ).rejects.toThrow('Not implemented yet');
    });

    it('keeps confident System 1 answers when System 2 is still unimplemented', async () => {
      // The dead-end exists only for escalations: a confident System 1 answer
      // is finished — the same answer 'auto' returns once System 2 exists.
      await expect(
        routeMode(
          { mode: 'auto' },
          {
            system1: vi.fn().mockResolvedValue('gut-answer'),
            confidence: (answer: string) => (answer === 'gut-answer' ? 0.99 : 0),
          },
        ),
      ).resolves.toBe('gut-answer');
    });

    it("throws 'Unsupported mode' for anything else", async () => {
      const system1 = vi.fn();
      await expect(
        // A JS caller can pass a value outside the Mode union at runtime.
        routeMode({ mode: 'system3' as unknown as 'system1' }, { system1 }),
      ).rejects.toThrow('Unsupported mode');
      expect(system1).not.toHaveBeenCalled();
    });
  });

  describe('knob validation', () => {
    it("throws when a JS caller sets thinking in 'system1' mode", async () => {
      const question: Routed = { mode: 'system1', thinking: true } as unknown as Routed;
      await expect(routeMode(question, { system1: vi.fn() })).rejects.toThrow(
        "thinking is only valid when mode is 'system2' or 'auto'",
      );
    });

    it('throws when a JS caller sets thinking with the mode omitted (System 1 default)', async () => {
      const question: Routed = { thinking: true } as unknown as Routed;
      await expect(routeMode(question, { system1: vi.fn() })).rejects.toThrow(
        "thinking is only valid when mode is 'system2' or 'auto'",
      );
    });

    it("accepts thinking in 'system2' and 'auto' mode", async () => {
      await expect(
        routeMode(
          { mode: 'system2', thinking: true },
          { system1: vi.fn(), system2: vi.fn().mockResolvedValue('ok') },
        ),
      ).resolves.toBe('ok');
      await expect(
        routeMode(
          { mode: 'auto', thinking: false },
          { system1: vi.fn().mockResolvedValue('plain'), system2: vi.fn(), confidence: () => 1 },
        ),
      ).resolves.toBe('plain');
    });

    it("throws when a JS caller sets autoModeThreshold outside 'auto' mode", async () => {
      await expect(
        routeMode({ mode: 'system1', autoModeThreshold: 0.9 } as unknown as Routed, {
          system1: vi.fn(),
        }),
      ).rejects.toThrow("autoModeThreshold is only valid in mode 'auto'");
      await expect(
        routeMode({ mode: 'system2', autoModeThreshold: 0.9 } as unknown as Routed, {
          system1: vi.fn(),
          system2: vi.fn(),
        }),
      ).rejects.toThrow("autoModeThreshold is only valid in mode 'auto'");
      // Omitted mode defaults to System 1, so the same rule catches it.
      await expect(
        routeMode({ autoModeThreshold: 0.9 } as unknown as Routed, { system1: vi.fn() }),
      ).rejects.toThrow("autoModeThreshold is only valid in mode 'auto'");
    });

    it("throws when the threshold is not a finite number between 0 and 1 in 'auto' mode", async () => {
      for (const bad of [NaN, Infinity, -0.1, 1.1, 'high', null]) {
        await expect(
          routeMode({ mode: 'auto', autoModeThreshold: bad } as unknown as Routed, {
            system1: vi.fn(),
            system2: vi.fn(),
            confidence: vi.fn(),
          }),
        ).rejects.toThrow(`autoModeThreshold must be a number between 0 and 1, got ${String(bad)}`);
      }
    });

    it('allows the whole 0..1 range for the threshold', async () => {
      await expect(
        routeMode({ mode: 'auto', autoModeThreshold: 0 } as unknown as Routed, {
          system1: vi.fn().mockResolvedValue('kept'),
          system2: vi.fn(),
          confidence: () => 1,
        }),
      ).resolves.toBe('kept');
    });
  });

  describe("'auto' escalation", () => {
    it('escalates low-confidence System 1 answers to System 2, once', async () => {
      const system1 = vi.fn().mockResolvedValue({ confidence: 0.4 });
      const system2 = vi.fn().mockResolvedValue({ confidence: 0.2 }); // still low
      const log = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const answer = await routeMode(
          { mode: 'auto', debug: true },
          {
            system1,
            system2,
            confidence: (a: { confidence: number }) => a.confidence,
          },
        );
        // The escalated answer is returned as-is, even at low confidence: one
        // escalation, never a loop.
        expect(answer).toEqual({ confidence: 0.2 });
        expect(system1).toHaveBeenCalledOnce();
        expect(system2).toHaveBeenCalledOnce();
        // The escalation decision is visible under debug, gray or not.
        const entries = log.mock.calls.map((c) => String(c[0])).join('');
        expect(entries).toContain(
          '[smart-decisions:auto] confidence 0.40 < threshold 0.70 — escalating to System 2',
        );
      } finally {
        log.mockRestore();
      }
    });

    it("keeps confident System 1 answers and doesn't touch System 2", async () => {
      const system1 = vi.fn().mockResolvedValue({ confidence: 0.9 });
      const system2 = vi.fn();
      const log = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      try {
        const answer = await routeMode(
          { mode: 'auto', debug: true, autoModeThreshold: 0.9 },
          {
            system1,
            system2,
            confidence: (a: { confidence: number }) => a.confidence,
          },
        );
        expect(answer).toEqual({ confidence: 0.9 });
        expect(system2).not.toHaveBeenCalled();
        // 0.90 is not below 0.90: strict comparison, and the log line says so.
        const entries = log.mock.calls.map((c) => String(c[0])).join('');
        expect(entries).toContain('confidence 0.90 ≥ threshold 0.90 — keeping the System 1 answer');
      } finally {
        log.mockRestore();
      }
    });

    it('escalates strictly below the custom threshold and applies the 0.7 default', async () => {
      // At exactly the threshold there is no escalation: < is strict.
      await expect(
        routeMode({ mode: 'auto', autoModeThreshold: 0.4 } as unknown as Routed, {
          system1: vi.fn().mockResolvedValue({ confidence: 0.4 }),
          system2: vi.fn().mockResolvedValue('escalated'),
          confidence: (a: { confidence: number }) => a.confidence,
        }),
      ).resolves.toEqual({ confidence: 0.4 });

      // Just under it escalates.
      await expect(
        routeMode({ mode: 'auto', autoModeThreshold: 0.4 } as unknown as Routed, {
          system1: vi.fn().mockResolvedValue({ confidence: 0.39 }),
          system2: vi.fn().mockResolvedValue('escalated'),
          confidence: (a: { confidence: number }) => a.confidence,
        }),
      ).resolves.toEqual('escalated');

      // With the threshold omitted, the 0.7 default: 0.7 stays, 0.69 escalates.
      await expect(
        routeMode({ mode: 'auto', autoModeThreshold: 0.7 } as unknown as Routed, {
          system1: vi.fn().mockResolvedValue({ confidence: 0.7 }),
          system2: vi.fn().mockResolvedValue('escalated'),
          confidence: (a: { confidence: number }) => a.confidence,
        }),
      ).resolves.toEqual({ confidence: 0.7 });
      await expect(
        routeMode({ mode: 'auto' } as unknown as Routed, {
          system1: vi.fn().mockResolvedValue({ confidence: 0.69 }),
          system2: vi.fn().mockResolvedValue('escalated'),
          confidence: (a: { confidence: number }) => a.confidence,
        }),
      ).resolves.toEqual('escalated');
    });
  });
});
