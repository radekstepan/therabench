import chalk from 'chalk';

/**
 * This module manages a global, adaptive delay to respect API rate limits.
 * It's a simple state machine that adjusts the delay based on API responses.
 */

// --- Configuration ---
const MIN_DELAY_MS = 50;        // Never go faster than a 50ms delay between requests.
const MAX_DELAY_MS = 60000;     // A 60-second ceiling to prevent excessive waits.
const INCREASE_FACTOR = 1.75;   // How aggressively to back off on failure if no retry-after header is present.
const DECREASE_AMOUNT_MS = 25;  // How quickly to recover after success.
const INITIAL_DELAY_MS = 50;    // Start with a small, safe delay.

let currentDelay = INITIAL_DELAY_MS;

/**
 * Gets the current delay value.
 */
export function getDelay(): number {
  return currentDelay;
}

/**
 * Authoritatively sets the delay to a specific value.
 * Used when we get a `retry-after` header from the API.
 * @param ms - The number of milliseconds to wait.
 */
export function setDelay(ms: number) {
  currentDelay = Math.min(MAX_DELAY_MS, ms);
  console.warn(chalk.yellow(`\n[ADAPTIVE-LIMITER] API requested a wait. Setting global delay to ${(currentDelay / 1000).toFixed(1)}s.`));
}

/**
 * Increases the global delay when a rate limit error is encountered without a `retry-after` header.
 */
export function increaseDelay() {
  const newDelay = currentDelay * INCREASE_FACTOR;
  currentDelay = Math.min(MAX_DELAY_MS, newDelay);
  console.warn(chalk.yellow(`\n[ADAPTIVE-LIMITER] Rate limit hit. Increasing global delay to ${(currentDelay / 1000).toFixed(1)}s.`));
}

/**
 * Decreases the global delay after a successful API call.
 */
export function decreaseDelay() {
  currentDelay = Math.max(MIN_DELAY_MS, currentDelay - DECREASE_AMOUNT_MS);
}
