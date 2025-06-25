import { ModelClient } from './ModelClient.js';

interface OpenAIConfig {
  base: string;
  model: string;
  key?: string; // API key is now optional.
}

export class OpenAIClient implements ModelClient {
  constructor(private cfg: OpenAIConfig) {}

  async generate({ prompt, json = false }: { prompt: string; json?: boolean }): Promise<string> {
    const endpoint = `${this.cfg.base}/chat/completions`;
    const body: any = {
      model: this.cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    };

    if (json) {
      body.response_format = { type: 'json_object' };
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    // Only add the Authorization header if an API key is provided.
    if (this.cfg.key) {
      headers['Authorization'] = `Bearer ${this.cfg.key}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error at ${this.cfg.base}: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error('API returned an empty response.');
        }
        return content.trim();

    } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
            throw new Error(`API fetch failed at ${endpoint}. Connection refused or host not found. Is the server running and is the URL in your .env file correct?`);
        }
        // Re-throw other errors, including the specific API error from the try block.
        throw error;
    }
  }
}
