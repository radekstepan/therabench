import { ModelClient } from './ModelClient.js';

interface OpenAIConfig {
  base: string;
  model: string;
  key: string;
}

export class OpenAIClient implements ModelClient {
  constructor(private cfg: OpenAIConfig) {}

  async generate({ prompt, json = false }: { prompt: string; json?: boolean }): Promise<string> {
    const body: any = {
      model: this.cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    };

    if (json) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${this.cfg.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI API returned an empty response.');
    }
    return content.trim();
  }
}
