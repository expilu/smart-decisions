import { describe, expect, it } from 'vitest';
import {
  splitThinking,
  extractJsonObject,
  validateRatings,
  ratingsSchema,
} from '../../../src/utils/llms/structured-output.js';

// The think tags are built from parts here too: nothing else in the suite
// should depend on their literal spelling staying clean through tooling.
const THINK_OPEN = `<th${'ink'}`;
const THINK_CLOSE = `</th${'ink'}`;

describe('splitThinking', () => {
  it('leaves a reply without think blocks untouched', () => {
    expect(splitThinking('{"a": 1}')).toEqual({ clean: '{"a": 1}', think: '' });
  });

  it('splits closed think blocks, case-insensitively', () => {
    const raw = `${THINK_OPEN} Looking... ${THINK_CLOSE}\n{"a": 1}`;
    expect(splitThinking(raw)).toEqual({ clean: '\n{"a": 1}', think: 'Looking...' });
  });

  it('splits an unterminated trailing block, leaving an empty visible answer', () => {
    // Truncation mid-thinking: the "answer" is nothing at all.
    const raw = `{"a": 1} ${THINK_OPEN} never finished`;
    expect(splitThinking(raw)).toEqual({ clean: '{"a": 1} ', think: 'never finished' });
    const allThink = `${THINK_OPEN} only thinking ${THINK_CLOSE}${THINK_OPEN} more`;
    expect(splitThinking(allThink)).toEqual({ clean: '', think: 'only thinking\nmore' });
  });

  it('keeps multiple blocks as separate think lines', () => {
    const raw = `${THINK_OPEN}one${THINK_CLOSE}${THINK_OPEN}two${THINK_CLOSE} answer`;
    expect(splitThinking(raw).think).toBe('one\ntwo');
    expect(splitThinking(raw).clean).toBe(' answer');
  });
});

describe('extractJsonObject', () => {
  it('parses a reply that is exactly an object', () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses past fences and prose', () => {
    expect(extractJsonObject('Here you go:\n```json\n{"a": {"b": 2}}\n```\nDone.')).toEqual({
      a: { b: 2 },
    });
  });

  it('returns the first balanced object, skipping braces inside strings', () => {
    // Braces inside string literals must not count, or prose containing braces
    // before the object would win; the FIRST balanced object is the answer.
    expect(extractJsonObject('use {"quoted": "not { this"} then {"real": 7}')).toEqual({
      quoted: 'not { this',
    });
  });

  it('is string-aware across escaped quotes and backslashes', () => {
    // Escapes inside strings must not terminate them; the object below is
    // balanced only when \\ and \" are read as escapes.
    expect(extractJsonObject('{"a": "x \\\\ path", "b": "say \\"hi\\"", "c": 3}')).toMatchObject({
      a: 'x \\ path',
    });
  });

  it('throws with the feedback-grade reason when there is no object', () => {
    expect(() => extractJsonObject('no object at all')).toThrow(
      'Parsing failed: no JSON object found in the reply',
    );
  });

  it('throws when the braces are unbalanced (truncation)', () => {
    expect(() => extractJsonObject('answer: {"a": 1,')).toThrow(
      'Parsing failed: no JSON object found in the reply',
    );
  });

  it('throws when the object does not parse', () => {
    // A balanced span whose content is not JSON (single quotes).
    expect(() => extractJsonObject('{a: 1}')).toThrow('Parsing failed');
  });

  it('throws on a reply holding no object braces at all', () => {
    expect(() => extractJsonObject('[1, 2]')).toThrow(
      'Parsing failed: no JSON object found in the reply',
    );
  });
});

describe('validateRatings', () => {
  const keys = ['walk', 'movie'];
  it('returns the ratings keyed as given', () => {
    expect(validateRatings({ movie: 2, walk: 8 }, keys)).toEqual({ walk: 8, movie: 2 });
  });

  it('accepts a structured reply arriving with extra whitespace or number forms only when integer', () => {
    // Integers are the schema; floats/strings are the rejections tested below.
    expect(validateRatings({ walk: 0, movie: 10 }, keys)).toEqual({ walk: 0, movie: 10 });
  });

  it('rejects non-object replies', () => {
    expect(() => validateRatings('8', keys)).toThrow(
      'the reply must be a JSON object with the keys "walk", "movie"',
    );
    expect(() => validateRatings(null, keys)).toThrow('the reply must be a JSON object');
    expect(() => validateRatings([8, 2], keys)).toThrow('the reply must be a JSON object');
  });

  it('rejects missing keys', () => {
    expect(() => validateRatings({ walk: 8 }, keys)).toThrow(
      'missing rating for "movie" — every key needs a rating',
    );
  });

  it('rejects non-integer, out-of-range and non-numeric ratings', () => {
    expect(() => validateRatings({ walk: 8.5, movie: 2 }, keys)).toThrow(
      'rating for "walk" must be an integer from 0 to 10, got 8.5',
    );
    expect(() => validateRatings({ walk: 11, movie: 2 }, keys)).toThrow(
      'rating for "walk" must be an integer from 0 to 10, got 11',
    );
    expect(() => validateRatings({ walk: -1, movie: 2 }, keys)).toThrow(
      'rating for "walk" must be an integer from 0 to 10, got -1',
    );
    expect(() => validateRatings({ walk: 'high', movie: 2 }, keys)).toThrow(
      'rating for "walk" must be an integer from 0 to 10, got high',
    );
  });

  it('rejects unexpected extra keys', () => {
    expect(() => validateRatings({ walk: 8, movie: 2, bonus: 1 }, keys)).toThrow(
      'unexpected key "bonus" — the reply must contain exactly "walk", "movie"',
    );
  });
});

describe('ratingsSchema', () => {
  it('builds the strict-style schema with one integer property per key', () => {
    expect(ratingsSchema(['walk', 'movie'])).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'ratings',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            walk: { type: 'integer', minimum: 0, maximum: 10 },
            movie: { type: 'integer', minimum: 0, maximum: 10 },
          },
          // `required` carries every property; `additionalProperties` closes
          // the object — the strict contract hosted OpenAI demands and other
          // engines follow far enough for grammar enforcement.
          required: ['walk', 'movie'],
          additionalProperties: false,
        },
      },
    });
  });
});
