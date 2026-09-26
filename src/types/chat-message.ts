/**
 * A message of the conversation, as accepted by OpenAI-compatible chat
 * completions APIs.
 *
 * @example
 * ```ts
 * const message: ChatMessage = { role: 'user', content: 'Hello!' };
 * ```
 */
export interface ChatMessage {
  /** Who is speaking: the prompt author (`user`), a previous model reply (`assistant`) or standing instructions (`system`) */
  role: 'system' | 'user' | 'assistant';
  /** Message text */
  content: string;
}
