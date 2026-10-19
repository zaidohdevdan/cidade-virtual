// packages/llm-adapters/gemini-adapter.ts
import type { LLMProviderAdapter, LLMRequest, LLMResponse } from './index.js';

export interface GeminiAdapterOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}

export class GeminiLLMAdapter implements LLMProviderAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options?: GeminiAdapterOptions) {
    this.apiKey = options?.apiKey ?? process.env['GEMINI_API_KEY'] ?? '';
    this.model = options?.model ?? process.env['GEMINI_MODEL'] ?? 'gemini-2.0-flash';
    this.timeoutMs = options?.timeoutMs ?? 10_000;
    this.baseUrl = options?.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModel(): string {
    return this.model;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('[GeminiLLMAdapter] GEMINI_API_KEY não configurada no ambiente.');
    }

    const startTime = Date.now();
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.prompt }],
        },
      ],
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: 350,
      },
    };

    if (req.systemPrompt) {
      body['systemInstruction'] = {
        parts: [{ text: req.systemPrompt }],
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`[GeminiLLMAdapter] Erro HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        usageMetadata?: {
          totalTokenCount?: number;
        };
      };

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
      const latencyMs = Date.now() - startTime;
      const tokenCount = data.usageMetadata?.totalTokenCount;

      return {
        content: text,
        tokenCount,
        latencyMs,
      };
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`[GeminiLLMAdapter] Timeout de ${this.timeoutMs}ms excedido na chamada.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
