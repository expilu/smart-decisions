import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system2Noul } from '../../src/system2/noul.js';

// Noul-specific behavior: the two-option rendering, the true/false rating
// ratio and the 0.5 neutral. Engine mechanics live in
// test/system2/system2.test.ts.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const question = (criteria?: { true?: string; false?: string }) => ({
  model: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'key',
    model: '/models/Qwen3.5-4B-Q4_K_M.gguf',
  },
  state: 'I have asked three times now. Can I please just talk to a real person?',
  instructions: 'Is the customer asking for a human agent?',
  ...(criteria !== undefined && { criteria }),
});

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('system2Noul', () => {
  it('turns the true/false ratings into a yes probability', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"true": 9, "false": 1}'));
    await expect(system2Noul(question())).resolves.toEqual({ noul: 0.9 });
  });

  it('reads a fully decided verdict exactly: 0 → 0, 10 → 1', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"true": 0, "false": 10}'));
    await expect(system2Noul(question())).resolves.toEqual({ noul: 0 });
  });

  it('reads the all-zero ratings as 0.5 — the visible no-clear-read neutral', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"true": 0, "false": 0}'));
    await expect(system2Noul(question())).resolves.toEqual({ noul: 0.5 });
  });

  it('renders the yes/no meanings into the prompt when the criteria carry them', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"true": 5, "false": 5}'));
    await system2Noul(question({ true: 'Explicitly asks for a person', false: 'No sign' }));

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const params = JSON.parse(init.body as string);
    expect(params.messages[0].content).toContain('true: yes — Explicitly asks for a person');
    expect(params.messages[0].content).toContain('false: no — No sign');
  });
});
