import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system2Prompt, system2Ratings } from '../../src/system2/system2.js';

// The engine is exercised through the global fetch, exactly like the System 1
// engine tests: a real Response per round, the reply text in message.content.
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

// The think tags are built from parts here too: nothing else in the suite
// should depend on their literal spelling staying clean through tooling.
const THINK_OPEN = `<th${'ink'}`;
const THINK_CLOSE = `</th${'ink'}`;

const model = { apiBaseUrl: 'https://example.com/v1', apiKey: 'key', model: 'model' };

const question = () => ({
  model,
  state: 'same state',
  instructions: 'same instructions',
  // Extra fields ride along structurally; the engine only reads model/transport.
  criteria: { whatever: 'value' },
});

const reply = (content: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ choices: [{ message: { content, ...extra } }] }), {
    status: 200,
  });

const prompt = () =>
  system2Prompt({
    question: { state: 'The sky is grey and heavy.', instructions: 'Where does this belong?' },
    listLabel: 'Options',
    lines: ['walk: Outside', 'movie: Inside'],
    keys: ['walk', 'movie'],
  });

const stderr = () => vi.spyOn(process.stderr, 'write').mockReturnValue(true);

describe('system2Prompt', () => {
  it('renders state, instructions, list and the ratings JSON closing', () => {
    expect(prompt()).toBe(
      'The sky is grey and heavy.\n\n' +
        'Where does this belong?\n\n' +
        'Options:\n' +
        'walk: Outside\n' +
        'movie: Inside\n\n' +
        'Rate how well each candidate fits this state and these instructions: ' +
        'score each one with an integer from 0 (does not fit at all) to 10 (fits perfectly). ' +
        'Reply with a single JSON object with exactly these keys — walk, movie — ' +
        'each holding its rating, and nothing else in your answer.',
    );
  });
});

describe('system2Ratings', () => {
  it('makes a structured, temperature-0 request with no token budget', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}'));
    await system2Ratings(question(), prompt(), ['walk', 'movie']);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://example.com/v1/chat/completions');
    const params = JSON.parse(init.body as string);
    expect(params.model).toBe('model');
    expect(params.temperature).toBe(0);
    // Deliberation needs room: no max_tokens default, server rules.
    expect(params.max_tokens).toBeUndefined();
    expect(params.stream).toBe(false);
    expect(params.messages).toEqual([{ role: 'user', content: prompt() }]);
    expect(params.response_format).toEqual(expect.objectContaining({ type: 'json_schema' }));
    expect(params.response_format.json_schema.strict).toBe(true);
    expect(params.response_format.json_schema.schema.required).toEqual(['walk', 'movie']);
    // thinking undefined → no knob sent, the engine default stands.
    expect(params.reasoning_effort).toBeUndefined();
  });

  it('disables thinking with reasoning_effort none, and only then', async () => {
    // A Response body reads once: fresh reply per call.
    fetchMock.mockImplementation(async () => reply('{"walk": 8, "movie": 2}'));
    await system2Ratings({ ...question(), thinking: false }, prompt(), ['walk', 'movie']);
    await system2Ratings({ ...question(), thinking: true }, prompt(), ['walk', 'movie']);

    const first = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(first.reasoning_effort).toBe('none');
    const second = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    // thinking: true rides the engine default — every reasoning model thinks.
    expect(second.reasoning_effort).toBeUndefined();
  });

  it('applies extraBody after its own defaults, protecting the System 2 reserved keys', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}'));
    await system2Ratings(
      {
        ...question(),
        model: {
          ...model,
          extraBody: {
            temperature: null, // strict reasoning model: clear our default
            max_completion_tokens: 4096,
            reasoning_effort: 'high', // escape hatch wins over our knob
            response_format: 'hijacked', // reserved → ignored
            chat_template_kwargs: { enable_thinking: false },
          },
        },
      },
      prompt(),
      ['walk', 'movie'],
    );

    const params = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(params.temperature).toBeUndefined();
    expect(params.max_completion_tokens).toBe(4096);
    expect(params.reasoning_effort).toBe('high');
    expect(params.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(params.response_format.type).toBe('json_schema');
  });

  it('returns validated ratings from a clean structured reply', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}'));
    await expect(system2Ratings(question(), prompt(), ['walk', 'movie'])).resolves.toEqual({
      walk: 8,
      movie: 2,
    });
  });

  it('recovers fenced and think-wrapped replies without extra attempts', async () => {
    // Each reply shape needs its own fresh Response (bodies read once), and
    // each must parse on the first attempt: no extra requests proves the
    // fallback layer never depends on the engine's own schema enforcement.
    for (const content of [
      '```json\n{"walk": 8, "movie": 2}\n```',
      `${THINK_OPEN}Let me weigh…${THINK_CLOSE}{"walk": 3, "movie": 7}`,
    ]) {
      fetchMock.mockResolvedValueOnce(reply(content));
      await expect(system2Ratings(question(), prompt(), ['walk', 'movie'])).resolves.toHaveProperty(
        'walk',
      );
      expect(fetchMock).toHaveBeenCalledOnce();
      fetchMock.mockClear();
    }
  });

  it('feeds the rejection back and answers again inside the retry budget', async () => {
    fetchMock
      .mockResolvedValueOnce(reply('walk 8 movie 2')) // not JSON → parse fail
      .mockResolvedValueOnce(reply('{"walk": 11, "movie": 2}')) // out of range
      .mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}')); // good
    await expect(system2Ratings(question(), prompt(), ['walk', 'movie'])).resolves.toEqual({
      walk: 8,
      movie: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Feedback pairs: the model's own bad reply, then the stated reason.
    const second = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(second.messages.at(-2)).toEqual({
      role: 'assistant',
      content: 'walk 8 movie 2',
    });
    expect(second.messages.at(-1)?.content).toContain('Your reply was not valid');
    expect(second.messages.at(-1)?.content).toContain('no JSON object found');
    const third = JSON.parse((fetchMock.mock.calls[2]![1] as RequestInit).body as string);
    expect(third.messages.at(-1)?.content).toContain('must be an integer from 0 to 10');
  });

  it('treats an empty visible answer as a rejection and retries', async () => {
    fetchMock
      .mockResolvedValueOnce(
        // A misbehaving engine may answer without a message at all — same
        // failure surface as an answer that is only reasoning.
        new Response(JSON.stringify({ choices: [{}] }), { status: 200 }),
      )
      .mockResolvedValueOnce(reply('')) // reasoning ate the budget, no answer
      .mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}'));
    await expect(system2Ratings(question(), prompt(), ['walk', 'movie'])).resolves.toEqual({
      walk: 8,
      movie: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const second = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(second.messages.at(-1)?.content).toContain('no answer text');
  });

  it('shows the reasoning text under debug, from whichever field it arrived in', async () => {
    const log = stderr();
    try {
      fetchMock
        .mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}', { reasoning_content: 'via field' }))
        .mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}', { reasoning: 'via openrouter' }))
        .mockResolvedValueOnce(
          reply(`${THINK_OPEN} inline here ${THINK_CLOSE}{"walk": 8, "movie": 2}`),
        );
      for (const debug of [true, true, true] as const) {
        await system2Ratings({ ...question(), debug }, prompt(), ['walk', 'movie']);
      }
      expect(log).toHaveBeenCalled();
      const joined = log.mock.calls.map((c) => String(c[0])).join('');
      expect(joined).toContain('via field');
      expect(joined).toContain('via openrouter');
      expect(joined).toContain('inline here');
    } finally {
      log.mockRestore();
    }
  });

  it('logs nothing to stderr when debug is off', async () => {
    const log = stderr();
    try {
      fetchMock.mockResolvedValueOnce(reply('{"walk": 8, "movie": 2}'));
      await system2Ratings(question(), prompt(), ['walk', 'movie']);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('throws with the last rejection reason after exhausting the attempt budget', async () => {
    // A Response body reads once: every attempt needs its own fresh one.
    fetchMock.mockImplementation(async () => reply('still not json'));
    await expect(system2Ratings(question(), prompt(), ['walk', 'movie'])).rejects.toThrow(
      /after 3 attempts: Parsing failed: no JSON object found/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3); // maxRetries 2 → 3 attempts
  });

  it('sanitizes a garbage maxRetries: negative → 1 attempt total, NaN/Infinity → the default 2 retries', async () => {
    // Mirror of the transport sanitize: non-finite falls back to the default
    // (2 retries → 3 attempts), negative floors to 0 → 1 attempt.
    for (const [maxRetries, attempts] of [
      [-3, 1],
      [Number.NaN, 3],
    ] as const) {
      fetchMock.mockImplementation(async () => reply('nope'));
      await expect(
        system2Ratings({ ...question(), maxRetries }, prompt(), ['walk', 'movie']),
      ).rejects.toThrow(`after ${attempts} attempts`);
      expect(fetchMock).toHaveBeenCalledTimes(attempts);
      fetchMock.mockClear();
    }
  });
});
