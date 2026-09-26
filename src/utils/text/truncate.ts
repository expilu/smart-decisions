/**
 * Shortens a string to at most `maxChars` characters, ending with an ellipsis
 * (`…`) when it gets trimmed.
 *
 * Keeps oversized content readable inside longer texts, i.e. error messages or
 * log lines that would otherwise swallow whole HTML pages.
 *
 * @param body - The string to cap.
 * @param maxChars - Maximum number of characters to keep before the ellipsis.
 * @returns The string unchanged while within the limit, or its first `maxChars`
 *          characters followed by `…` otherwise.
 * @example
 * ```ts
 * truncate('short', 500); // 'short'
 * truncate('x'.repeat(600), 500); // 500 x's followed by '…'
 * ```
 */
export const truncate = (body: string, maxChars: number): string =>
  body.length > maxChars ? `${body.slice(0, maxChars)}…` : body;
