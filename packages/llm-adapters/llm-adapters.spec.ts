// packages/llm-adapters/llm-adapters.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiLLMAdapter,
  OpenAILLMAdapter,
  OllamaLLMAdapter,
  createDefaultLLMAdapter,
} from './index.js';

describe('LLM Adapters — Fornecedores Desacoplados de IA Generativa', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('GeminiLLMAdapter', () => {
    it('deve indicar isConfigured = false e lançar erro se não houver chave', async () => {
      delete process.env['GEMINI_API_KEY'];
      const adapter = new GeminiLLMAdapter({ apiKey: '' });
      expect(adapter.isConfigured()).toBe(false);

      await expect(adapter.complete({ prompt: 'Olá' })).rejects.toThrow(
        'GEMINI_API_KEY não configurada',
      );
    });

    it('deve chamar a API do Gemini com payload formatado e retornar resposta', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Resposta autônoma de Vega em Synapse City.' }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          totalTokenCount: 45,
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const adapter = new GeminiLLMAdapter({
        apiKey: 'test-gemini-key',
        model: 'gemini-2.0-flash',
      });

      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.getModel()).toBe('gemini-2.0-flash');

      const res = await adapter.complete({
        prompt: 'Qual o status da segurança viária?',
        systemPrompt: 'Você é Vega, guardiã de Synapse City.',
        temperature: 0.3,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('gemini-2.0-flash:generateContent');
      expect(String(url)).toContain('key=test-gemini-key');

      const body = JSON.parse(init?.body as string);
      expect(body.systemInstruction.parts[0].text).toBe('Você é Vega, guardiã de Synapse City.');
      expect(body.contents[0].parts[0].text).toBe('Qual o status da segurança viária?');
      expect(body.generationConfig.temperature).toBe(0.3);

      expect(res.content).toBe('Resposta autônoma de Vega em Synapse City.');
      expect(res.tokenCount).toBe(45);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('OpenAILLMAdapter', () => {
    it('deve indicar isConfigured = false e lançar erro se não houver chave', async () => {
      delete process.env['OPENAI_API_KEY'];
      const adapter = new OpenAILLMAdapter({ apiKey: '' });
      expect(adapter.isConfigured()).toBe(false);

      await expect(adapter.complete({ prompt: 'Oi' })).rejects.toThrow(
        'OPENAI_API_KEY não configurada',
      );
    });

    it('deve chamar chat/completions da OpenAI com Bearer token e retornar conteúdo', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Resposta gerada via GPT-4o-mini.' },
          },
        ],
        usage: {
          total_tokens: 38,
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const adapter = new OpenAILLMAdapter({
        apiKey: 'sk-test-openai-key',
        model: 'gpt-4o-mini',
      });

      const res = await adapter.complete({
        prompt: 'Qual seu trabalho?',
        systemPrompt: 'Você é Sulafat.',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('/chat/completions');
      expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer sk-test-openai-key');

      expect(res.content).toBe('Resposta gerada via GPT-4o-mini.');
      expect(res.tokenCount).toBe(38);
    });
  });

  describe('OllamaLLMAdapter', () => {
    it('deve chamar endpoint /api/chat local com stream false', async () => {
      const mockResponse = {
        message: { content: 'Resposta do modelo local Ollama.' },
        eval_count: 22,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const adapter = new OllamaLLMAdapter({
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2',
      });

      const res = await adapter.complete({
        prompt: 'Testando modelo local',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res.content).toBe('Resposta do modelo local Ollama.');
      expect(res.tokenCount).toBe(22);
    });
  });

  describe('createDefaultLLMAdapter (Factory)', () => {
    it('deve retornar undefined se nenhuma variável de ambiente estiver configurada', () => {
      delete process.env['GEMINI_API_KEY'];
      delete process.env['OPENAI_API_KEY'];
      delete process.env['OLLAMA_BASE_URL'];
      delete process.env['USE_OLLAMA'];

      const adapter = createDefaultLLMAdapter();
      expect(adapter).toBeUndefined();
    });

    it('deve instanciar GeminiLLMAdapter prioritariamente quando GEMINI_API_KEY estiver presente', () => {
      process.env['GEMINI_API_KEY'] = 'fake-gemini-key';
      delete process.env['OPENAI_API_KEY'];

      const adapter = createDefaultLLMAdapter();
      expect(adapter).toBeInstanceOf(GeminiLLMAdapter);
      expect(adapter?.isConfigured?.()).toBe(true);
    });

    it('deve instanciar OpenAILLMAdapter quando apenas OPENAI_API_KEY estiver presente', () => {
      delete process.env['GEMINI_API_KEY'];
      process.env['OPENAI_API_KEY'] = 'fake-openai-key';

      const adapter = createDefaultLLMAdapter();
      expect(adapter).toBeInstanceOf(OpenAILLMAdapter);
      expect(adapter?.isConfigured?.()).toBe(true);
    });
  });
});
