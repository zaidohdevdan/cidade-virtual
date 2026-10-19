// packages/llm-adapters/openai-adapter.ts
import type { LLMProviderAdapter, LLMRequest, LLMResponse } from './index.js';

export interface OpenAIAdapterOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}

export class OpenAILLMAdapter implements LLMProviderAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options?: OpenAIAdapterOptions) {
    this.apiKey = options?.apiKey ?? process.env['OPENAI_API_KEY'] ?? '';
    this.model = options?.model ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini';
    this.timeoutMs = options?.timeoutMs ?? 10_000;
    this.baseUrl = options?.baseUrl ?? process.env['OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModel(): string {
    return this.model;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('[OpenAILLMAdapter] OPENAI_API_KEY não configurada no ambiente.');
    }

    const startTime = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: 350,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`[OpenAILLMAdapter] Erro HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
        usage?: {
          total_tokens?: number;
        };
      };

      const text = data.choices?.[0]?.message?.content?.trim() ?? '';
      const latencyMs = Date.now() - startTime;
      const tokenCount = data.usage?.total_tokens;

      return {
        content: text,
        tokenCount,
        latencyMs,
      };
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`[OpenAILLMAdapter] Timeout de ${this.timeoutMs}ms excedido na chamada.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
