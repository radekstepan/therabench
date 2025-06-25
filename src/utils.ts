/**
 * A simple promise-based delay function.
 * @param ms - The number of milliseconds to wait.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RetryOptions {
  retries: number;
  initialDelay: number; // in ms
}

/**
 * A higher-order function that wraps an async function with retry logic.
 * It specifically targets retryable errors like '429 Too Many Requests'.
 * @param fn - The async function to execute.
 * @param options - Configuration for retries and delay.
 * @returns The result of the wrapped function.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { retries: 5, initialDelay: 2000 }
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Only retry on specific, transient errors like rate limiting.
      if (error.message && error.message.includes('429')) {
        const delayTime = options.initialDelay * Math.pow(2, i) + Math.random() * 1000;
        console.warn(`\n[WARN] Rate limit hit. Retrying in ${(delayTime / 1000).toFixed(1)}s... (Attempt ${i + 1}/${options.retries})`);
        await delay(delayTime);
      } else {
        // For non-retryable errors (e.g., 401 Unauthorized, 400 Bad Request), fail fast.
        throw error;
      }
    }
  }
  throw new Error(`API call failed after ${options.retries} retries. Last error: ${lastError?.message}`);
}
