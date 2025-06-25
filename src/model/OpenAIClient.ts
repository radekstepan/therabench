import { ModelClient } from './ModelClient.js';
import * as limiter from '../limiter.js';
import { delay } from '../delay.js';

interface OpenAIConfig {
  base: string;
  model: string;
  key?: string;
}

export class OpenAIClient implements ModelClient {
  constructor(private cfg: OpenAIConfig) {}

  async generate({ prompt, json = false }: { prompt: string; json?: boolean }): Promise<string> {
    const MAX_RETRIES = 5;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // 1. Always wait for the current global adaptive delay before making a request.
      const waitTime = limiter.getDelay();
      if (waitTime > 0) {
        await delay(waitTime);
      }
      
      const endpoint = `${this.cfg.base}/chat/completions`;
      const body: any = { model: this.cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1 };
      if (json) body.response_format = { type: 'json_object' };
      
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (this.cfg.key) headers['Authorization'] = `Bearer ${this.cfg.key}`;

      try {
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });

        // 2. Success Case
        if (response.ok) {
          limiter.decreaseDelay(); // Success, so we can try to speed up slightly for the next request.
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          if (!content) throw new Error('API returned an empty response.');
          return content.trim();
        }

        // 3. Rate Limit Case
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            // The API told us exactly how long to wait.
            const waitSeconds = parseFloat(retryAfter);
            if (!isNaN(waitSeconds)) {
              limiter.setDelay(waitSeconds * 1000 + 500); // Set global delay and add 500ms buffer.
              continue; // Immediately continue to the next retry attempt, which will use the new delay.
            }
          }
          // If no `retry-after` header, use the fallback exponential increase.
          limiter.increaseDelay();
          continue;
        }

        // 4. Other Hard Failures (e.g., 401, 400)
        const errorText = await response.text();
        throw new Error(`API error at ${this.cfg.base}: ${response.status} ${response.statusText} - ${errorText}`);
      
      } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
          throw new Error(`API fetch failed at ${endpoint}. Connection refused or host not found. Is the server running and is the URL in your .env file correct?`);
        }
        // Re-throw other errors to fail the request immediately.
        throw error;
      }
    }

    throw new Error(`API call failed after ${MAX_RETRIES} retries. The API continued to return rate limit errors.`);
  }
}
