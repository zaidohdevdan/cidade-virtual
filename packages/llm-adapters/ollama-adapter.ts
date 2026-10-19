// packages/llm-adapters/ollama-adapter.ts
import type { LLMProviderAdapter, LLMRequest, LLMResponse } from './index.js';

export interface OllamaAdapterOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class OllamaLLMAdapter implements LLMProviderAdapter {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: OllamaAdapterOptions) {
    this.baseUrl = options?.baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434';
    this.model = options?.model ?? process.env['OLLAMA_MODEL'] ?? 'llama3.2';
    this.timeoutMs = options?.timeoutMs ?? 15_000;
  }

  getModel(): string {
    return this.model;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/chat`;

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
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: req.temperature ?? 0.7,
            num_predict: 350,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`[OllamaLLMAdapter] Erro HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        message?: { content?: string };
        eval_count?: number;
      };

      const text = data.message?.content?.trim() ?? '';
      const latencyMs = Date.now() - startTime;

      return {
        content: text,
        tokenCount: data.eval_count,
        latencyMs,
      };
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`[OllamaLLMAdapter] Timeout de ${this.timeoutMs}ms ao conectar em ${this.baseUrl}.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
