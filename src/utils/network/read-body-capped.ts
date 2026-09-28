/**
 * Reads an HTTP response body into a string, refusing to buffer more than a
 * safety cap of bytes.
 *
 * The naive `response.text()` buffers the whole body in memory before the caller
 * ever looks at the status code — so a misbehaving server (broken, compromised,
 * or reached through a bad base URL) can exhaust the host process with a single
 * multi-gigabyte answer. This reads the body in chunks instead and aborts the
 * moment the cap is exceeded, in either of two ways:
 *
 * - A declared `Content-Length` above the cap fails immediately, without reading
 *   a single byte of the body.
 * - A streamed (or undeclared) body fails as soon as the accumulated bytes cross
 *   the cap, tearing the connection down instead of buffering the rest.
 *
 * The thrown error is tagged (see `isBodyTooLargeError`) so callers can tell this
 * deterministic failure apart from transient network errors and skip retrying it.
 *
 * @param response - The (not yet consumed) HTTP response to read.
 * @param maxBytes - Safety cap, in bytes, on the buffered body.
 * @returns The full body text, decoded as UTF-8.
 * @throws A `BodyTooLargeError`-tagged error when the body is over the cap —
 *         recognized by `isBodyTooLargeError`.
 * @example
 * ```ts
 * const text = await readBodyCapped(response, 10 * 1024 * 1024);
 * try {
 *   await readBodyCapped(hugeResponse, 1024);
 * } catch (err) {
 *   isBodyTooLargeError(err); // true
 * }
 * ```
 */
export async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  const tooLarge = (): Error => {
    const mb = maxBytes / (1024 * 1024);
    // The default cap reads as "10 MB"; test caps below a megabyte as exact bytes.
    const cap = mb >= 1 ? `${Math.floor(mb)} MB` : `${maxBytes} bytes`;
    const err = new Error(`response body exceeds the ${cap} safety cap — refusing to read it`);
    err.name = BODY_TOO_LARGE;
    return err;
  };

  // A declared length over the cap is settled before the first byte is read.
  const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isInteger(declared) && declared > maxBytes) {
    throw tooLarge();
  }

  // No stream to read from (i.e. `new Response(null)`): nothing to cap, fall back.
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      // Tear the connection down instead of buffering the rest of the body.
      // A rejection here surfaces through the caller's error handling like any
      // other read failure.
      await reader.cancel();
      throw tooLarge();
    }
    // stream: true keeps multi-byte characters that span chunk boundaries intact.
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Error name tagging the deterministic "body over the cap" failure. */
const BODY_TOO_LARGE = 'BodyTooLargeError';

/**
 * Whether a thrown value is the tagged error `readBodyCapped` raises for a body
 * over its cap.
 *
 * Unlike timeouts or resets, an oversized body cannot shrink on a retry — the
 * same request will answer oversized again — so callers use this to fail fast
 * instead of burning their retry budget.
 *
 * @param err - The thrown value, of any type.
 * @returns Whether the value is the tagged too-large error.
 * @example
 * ```ts
 * isBodyTooLargeError(await readBodyCapped(huge, 1024).catch((e) => e)); // true
 * isBodyTooLargeError(new DOMException('timed out', 'TimeoutError')); // false
 * isBodyTooLargeError('boom'); // false
 * ```
 */
export const isBodyTooLargeError = (err: unknown): boolean =>
  err instanceof Error && err.name === BODY_TOO_LARGE;
