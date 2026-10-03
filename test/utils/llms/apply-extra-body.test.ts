import { describe, expect, it } from 'vitest';
import type { ChatCompletionRequest } from '../../../src/types/chat-completion-request.js';
import { applyExtraBody } from '../../../src/utils/llms/apply-extra-body.js';

// Baseline body mirroring what system1Choice builds: the two required fields plus
// every sampling knob the single-token trick depends on.
const baseline = (): ChatCompletionRequest => ({
  model: 'model',
  messages: [{ role: 'user', content: 'hi' }],
  max_tokens: 1,
  temperature: 0,
  logprobs: true,
  top_logprobs: 20,
  chat_template_kwargs: { enable_thinking: false },
});

describe('applyExtraBody', () => {
  it('returns the request untouched when extraBody is undefined', () => {
    const request = baseline();
    expect(applyExtraBody(request, undefined)).toBe(request);
    expect(applyExtraBody(request, undefined)).toEqual(baseline());
  });

  it('adds unknown keys verbatim', () => {
    expect(applyExtraBody(baseline(), { reasoning_effort: 'none', think: false })).toEqual({
      ...baseline(),
      reasoning_effort: 'none',
      think: false,
    });
  });

  it('ignores every reserved key', () => {
    // Each reserved key tries to override the baseline with a poisoned value; the
    // baseline must come out untouched for all of them.
    const sabotage = {
      model: 'other',
      messages: [],
      stream: true,
      logprobs: false,
      top_logprobs: 1,
      max_tokens: 100,
      temperature: 2,
    } as Record<string, unknown>;
    expect(applyExtraBody(baseline(), sabotage)).toEqual(baseline());
  });

  it('merges chat_template_kwargs one level deep, keeping the default and adding sibling keys', () => {
    expect(
      applyExtraBody(baseline(), {
        chat_template_kwargs: { thinking: false }, // DeepSeek/Granite key, alongside Qwen3's
      }),
    ).toEqual({
      ...baseline(),
      chat_template_kwargs: { enable_thinking: false, thinking: false },
    });
  });

  it('lets user keys win per key inside chat_template_kwargs', () => {
    expect(
      applyExtraBody(baseline(), {
        chat_template_kwargs: { enable_thinking: true }, // user flips the default
      }),
    ).toEqual({
      ...baseline(),
      chat_template_kwargs: { enable_thinking: true },
    });
  });

  it('ignores non-object chat_template_kwargs, keeping the engine defaults', () => {
    // null, a string and an array are all non-plain-object values for the merge; the
    // baseline default must survive each of them.
    expect(applyExtraBody(baseline(), { chat_template_kwargs: null })).toEqual(baseline());
    expect(applyExtraBody(baseline(), { chat_template_kwargs: 'enable_thinking=false' })).toEqual(
      baseline(),
    );
    expect(applyExtraBody(baseline(), { chat_template_kwargs: ['enable_thinking'] })).toEqual(
      baseline(),
    );
  });

  it('adds chat_template_kwargs when the baseline request has none', () => {
    const request: ChatCompletionRequest = { model: 'm', messages: [] };
    expect(applyExtraBody(request, { chat_template_kwargs: { thinking: false } })).toEqual({
      model: 'm',
      messages: [],
      chat_template_kwargs: { thinking: false },
    });
  });

  it('adds no chat_template_kwargs key when neither side has one', () => {
    const request: ChatCompletionRequest = { model: 'm', messages: [] };
    expect(applyExtraBody(request, { seed: 42 })).toEqual({ model: 'm', messages: [], seed: 42 });
  });

  it('ignores prototype-smuggling keys so the request object cannot be reparented', () => {
    // JSON.parse is the classic way an own enumerable __proto__ property appears
    // in a config object; assigning it with [[Set]] would replace the request's
    // prototype instead of adding a harmless body key.
    const poisoned: Record<string, unknown> = JSON.parse(
      '{"__proto__": {"polluted": true}, "constructor": 42, "seed": 7}',
    );
    const merged = applyExtraBody(baseline(), poisoned);
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.hasOwn(merged, '__proto__')).toBe(false);
    expect(merged).toEqual({ ...baseline(), seed: 7 }); // normal keys still flow
  });

  it('keeps extra top-level keys already present on the request and returns a new object, never mutating the input', () => {
    const request = { ...baseline(), reasoning_effort: 'low' };
    const merged = applyExtraBody(request, { seed: 7 });
    expect(merged).not.toBe(request);
    expect(merged).toEqual({ ...baseline(), reasoning_effort: 'low', seed: 7 });
    // Input untouched: still the value it was constructed with (baseline + the
    // reasoning_effort key the caller set).
    expect(request).toEqual({ ...baseline(), reasoning_effort: 'low' });
    // The reasoning_effort key the caller already set survives the merge.
    expect(merged).toHaveProperty('reasoning_effort', 'low');
  });

  it('deletes a non-reserved key when its extraBody value is null', () => {
    // null removes a library default from the wire request — the only way the
    // merge can REMOVE a key, needed when strict servers reject one (System 2
    // too: its narrower reserved set makes temperature deletable there).
    const request: ChatCompletionRequest = {
      model: 'm',
      messages: [],
      temperature: 0,
      reasoning_effort: 'low',
    };
    const merged = applyExtraBody(request, { reasoning_effort: null, seed: null });
    expect(merged).toEqual({ model: 'm', messages: [], temperature: 0 });
    // `toEqual` treats undefined-valued keys and absent keys as equal, but
    // `Object.keys` shows the key was deleted, not merely null-ed.
    expect(Object.keys(merged)).not.toContain('reasoning_effort');
    // A null value for a reserved key is not a deletion: reserved keys skip
    // entirely, in every direction.
    expect(applyExtraBody(baseline(), { temperature: null })).toEqual(baseline());
    expect(Object.keys(applyExtraBody(baseline(), { temperature: null }))).toContain('temperature');
  });

  it('ignores null on a key that was never on the request', () => {
    const request: ChatCompletionRequest = { model: 'm', messages: [] };
    expect(applyExtraBody(request, { banana: null })).toEqual({ model: 'm', messages: [] });
  });

  it('honors a custom (System 2) reserved-key set: narrower protection, plus null-deletion', () => {
    const request: ChatCompletionRequest = {
      model: 'm',
      messages: [],
      temperature: 0,
      thinking: false, // not the question's knob: an engine-specific key
    };
    const merged = applyExtraBody(
      request,
      { temperature: null, model: 'hijacked' },
      { reservedKeys: new Set(['model', 'messages', 'stream', 'response_format']) },
    );
    // System 2 reserves less: temperature is deletable, model still protected.
    expect(merged).toEqual({ model: 'm', messages: [], thinking: false });
  });
});
