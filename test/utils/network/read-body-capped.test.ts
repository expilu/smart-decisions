import { describe, expect, it } from 'vitest';
import {
  isBodyTooLargeError,
  readBodyCapped,
} from '../../../src/utils/network/read-body-capped.js';

// Builds a body stream with no Content-Length, handing out the given chunks
// one read at a time — the shape an undeclared/chunked server response has.
const streamBody = (...chunks: string[]): ReadableStream<Uint8Array> => {
  const encoded = chunks.map((c) => new TextEncoder().encode(c));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = encoded.shift();
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
  });
};

describe('readBodyCapped', () => {
  it('returns the text of a body within the cap', async () => {
    const response = new Response('hello logprobs', { headers: { 'content-length': '14' } });
    await expect(readBodyCapped(response, 1024)).resolves.toBe('hello logprobs');
  });

  it('rejects a declared Content-Length over the cap without reading the body', async () => {
    // If the body were ever read, its pull would throw and the rejection would be
    // THAT error instead of the cap error — so the assertion below doubles as the
    // proof that the cap is settled from the header alone. (The stream's eager
    // controller pull erroring on its own is unobserved: nobody reads it.)
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('the body must never be read');
      },
    });
    const response = new Response(body, { headers: { 'content-length': '3000000' } });

    await expect(readBodyCapped(response, 2 * 1024 * 1024)).rejects.toThrow(
      'response body exceeds the 2 MB safety cap — refusing to read it',
    );
  });

  it('rejects a streamed body the moment it crosses the cap', async () => {
    // No Content-Length: the cap fires mid-stream, on the chunk that overflows.
    const response = new Response(streamBody('aaaa', 'bbbb', 'cccc'));
    await expect(readBodyCapped(response, 6)).rejects.toThrow(
      'response body exceeds the 6 bytes safety cap — refusing to read it',
    );
  });

  it('assembles a streamed body that stays under the cap', async () => {
    const response = new Response(streamBody('aaaa', 'bb'));
    await expect(readBodyCapped(response, 1024)).resolves.toBe('aaaabb');
  });

  it('keeps multi-byte characters intact across chunk boundaries', async () => {
    // 'é' is two UTF-8 bytes; split them across two chunks and cap above the total.
    const bytes = new TextEncoder().encode('é');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    });
    const response = new Response(stream);
    await expect(readBodyCapped(response, 1024)).resolves.toBe('é');
  });

  it('falls back to text() when the response has no stream at all', async () => {
    // new Response(null) exposes body === null; nothing to cap, nothing to read.
    const response = new Response(null, { status: 200 });
    await expect(readBodyCapped(response, 1024)).resolves.toBe('');
  });

  it('tags its rejections so callers can avoid retrying them', async () => {
    const response = new Response('x'.repeat(17), { headers: { 'content-length': '17' } });
    const err = await readBodyCapped(response, 16).catch((e: unknown) => e);
    expect(isBodyTooLargeError(err)).toBe(true);
    expect(isBodyTooLargeError(new Error('network reset'))).toBe(false);
    expect(isBodyTooLargeError(new DOMException('timed out', 'TimeoutError'))).toBe(false);
    expect(isBodyTooLargeError('boom')).toBe(false);
  });
});
