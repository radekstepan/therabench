import { delay } from './delay.js'; // A separate simple delay function
import * as limiter from './limiter.js';

interface RetryOptions {
  retries: number;
  initialDelay: number; // in ms, for local retry
}

/**
 * A higher-order function that wraps an async function with both:
 * 1. An initial adaptive delay to pace requests.
 * 2. A local retry-with-backoff mechanism for the specific call.
 */
export async function withAdaptiveRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { retries: 5, initialDelay: 1000 }
): Promise<T> {
  // 1. Wait for the current global adaptive delay before starting.
  const globalDelay = limiter.getDelay();
  if (globalDelay > 0) {
    await delay(globalDelay);
  }

  let lastError: Error | undefined;

  for (let i = 0; i < options.retries; i++) {
    try {
      const result = await fn();
      // On success, slightly decrease the global delay for the next operation.
      limiter.decreaseDelay();
      return result;
    } catch (error: any) {
      lastError = error;
      if (error.message && error.message.includes('429')) {
        // 2. On rate limit, increase the global delay significantly.
        limiter.increaseDelay();
        // Also apply a local, randomized backoff for this specific retry attempt.
        const localRetryDelay = options.initialDelay * Math.pow(2, i) + Math.random() * 1000;
        await delay(localRetryDelay);
      } else {
        // For non-retryable errors, fail fast.
        throw error;
      }
    }
  }
  throw new Error(`API call failed after ${options.retries} retries. Last error: ${lastError?.message}`);
}
