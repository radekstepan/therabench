import { ModelClient } from './ModelClient.js';

interface OllamaConfig {
  base: string;
  model: string;
}

export class OllamaClient implements ModelClient {
  constructor(private cfg: OllamaConfig) {}

  async generate({ prompt, json = false }: { prompt: string; json?: boolean }): Promise<string> {
    const body: any = {
      model: this.cfg.model,
      prompt: prompt,
      stream: false, // We want the full response at once
    };

    if (json) {
      body.format = 'json';
    }

    const response = await fetch(`${this.cfg.base}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.response;

    if (!content) {
      throw new Error('Ollama API returned an empty response.');
    }
    return content.trim();
  }
}
