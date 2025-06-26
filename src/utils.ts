import { delay } from './delay.js';
import * as limiter from './limiter.js';
import chalk from 'chalk';

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
      
      // Check for retryable errors
      if (error.message && error.message.includes('429')) {
        // Handle rate limits by increasing the global delay.
        limiter.increaseDelay();
        const localRetryDelay = options.initialDelay * Math.pow(2, i) + Math.random() * 1000;
        await delay(localRetryDelay);
        continue; // Go to next retry attempt
      } else if (error.message && error.message.includes('Unexpected end of JSON input')) {
        // FIX: Handle incomplete/empty JSON responses, which are transient errors.
        console.warn(chalk.yellow(`\n[WARN] Received incomplete JSON from API. Retrying... (Attempt ${i + 1}/${options.retries})`));
        // Apply a local retry delay but do NOT increase the global pacer.
        const localRetryDelay = options.initialDelay * (i + 1);
        await delay(localRetryDelay);
        continue; // Go to next retry attempt
      }
      else {
        // For non-retryable errors (e.g., 401 Unauthorized, 400 Bad Request), fail fast.
        throw error;
      }
    }
  }
  throw new Error(`API call failed after ${options.retries} retries. Last error: ${lastError?.message}`);
}
