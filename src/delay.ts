/**
 * A simple promise-based delay function.
 * @param ms - The number of milliseconds to wait.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
