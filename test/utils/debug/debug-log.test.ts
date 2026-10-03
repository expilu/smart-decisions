import { afterEach, describe, expect, it } from 'vitest';
import { debugLog } from '../../../src/utils/debug/debug-log.js';

// The exact bytes that reach the stream are observable: a fake write-stream
// with or without isTTY stands in for process.stderr.
class FakeStream {
  lines: string[] = [];
  constructor(
    public isTTY: boolean | undefined,
    public noColor = false,
  ) {}
  hasColors = (count?: number): boolean => (count ?? 0) <= 2;
  write = (chunk: string): boolean => {
    this.lines.push(chunk);
    return true;
  };
}

describe('debugLog', () => {
  afterEach(() => {
    delete process.env.NO_COLOR;
  });

  it('emits the formatted entry to the stream when enabled', () => {
    const stream = new FakeStream(false);
    debugLog(true, 'system1', 'prompt', 'the prompt text', stream as never);
    expect(stream.lines).toEqual(['[smart-decisions:system1] prompt\nthe prompt text\n']);
  });

  it('emits label-only entries and switches the origin per layer', () => {
    const stream = new FakeStream(false);
    debugLog(true, 'transport', 'HTTP 500 response', undefined, stream as never);
    expect(stream.lines).toEqual(['[smart-decisions:transport] HTTP 500 response\n']);
  });

  it('emits nothing when the flag is off or undefined', () => {
    const stream = new FakeStream(false);
    debugLog(false, 'system1', 'nope', undefined, stream as never);
    debugLog(undefined, 'system1', 'nope', undefined, stream as never);
    expect(stream.lines).toEqual([]);
  });

  it('wraps the entry in ANSI dark gray on a color-capable TTY', () => {
    const stream = new FakeStream(true);
    debugLog(true, 'system2', 'reasoning', 'Let me think…', stream as never);
    expect(stream.lines).toEqual([
      '[smart-decisions:system2] \x1b[90mreasoning\nLet me think…\x1b[0m\n',
    ]);
  });

  it('stays plain when the terminal cannot show color', () => {
    const stream = new FakeStream(true);
    stream.hasColors = () => false;
    debugLog(true, 'system2', 'plain', undefined, stream as never);
    expect(stream.lines).toEqual(['[smart-decisions:system2] plain\n']);
  });

  it('stays plain when NO_COLOR is set, whatever the TTY', () => {
    process.env.NO_COLOR = '1';
    const stream = new FakeStream(true);
    debugLog(true, 'system2', 'plain', undefined, stream as never);
    expect(stream.lines).toEqual(['[smart-decisions:system2] plain\n']);
  });

  it('caps over-long payloads at 2000 characters plus an ellipsis', () => {
    const stream = new FakeStream(false);
    const long = 'x'.repeat(3000);
    debugLog(true, 'system2', 'payload', long, stream as never);
    // The cap counts the whole entry, label included: 2000 chars plus '…'.
    expect(stream.lines[0]).toBe(`[smart-decisions:system2] payload\n${'x'.repeat(1992)}…\n`);
  });
  it('never writes when the stream has no write function', () => {
    expect(() => debugLog(true, 'system2', 'x', undefined, {} as never)).not.toThrow();
  });
});
