/**
 * Waits for the given amount of time.
 *
 * A promise-based `setTimeout`, for pausing between the steps of an async flow.
 *
 * @param ms - Milliseconds to wait before the promise resolves.
 * @returns A promise that resolves once the delay has elapsed.
 * @example
 * ```ts
 * await sleep(500); // resumes half a second later
 * ```
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
