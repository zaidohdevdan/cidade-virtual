// packages/llm-adapters/factory.ts
import type { LLMProviderAdapter } from './index.js';
import { GeminiLLMAdapter } from './gemini-adapter.js';
import { OpenAILLMAdapter } from './openai-adapter.js';
import { OllamaLLMAdapter } from './ollama-adapter.js';

export interface AutoLLMAdapterOptions {
  prefer?: 'gemini' | 'openai' | 'ollama';
}

/**
 * Cria dinamicamente a melhor instância de LLMProviderAdapter disponível
 * a partir das variáveis de ambiente configuradas:
 * 1. GEMINI_API_KEY -> GeminiLLMAdapter (gemini-2.0-flash)
 * 2. OPENAI_API_KEY -> OpenAILLMAdapter (gpt-4o-mini)
 * 3. OLLAMA_BASE_URL (se definido explicitamente) -> OllamaLLMAdapter
 * 4. undefined se nenhuma credencial for detectada (mantendo o modo local gracioso).
 */
export function createDefaultLLMAdapter(options?: AutoLLMAdapterOptions): LLMProviderAdapter | undefined {
  const prefer = options?.prefer;

  if (prefer === 'gemini' && process.env['GEMINI_API_KEY']) {
    return new GeminiLLMAdapter();
  }
  if (prefer === 'openai' && process.env['OPENAI_API_KEY']) {
    return new OpenAILLMAdapter();
  }
  if (prefer === 'ollama' && process.env['OLLAMA_BASE_URL']) {
    return new OllamaLLMAdapter();
  }

  // Detecção automática por precedência padrão
  if (process.env['GEMINI_API_KEY'] && process.env['GEMINI_API_KEY'].trim().length > 0) {
    return new GeminiLLMAdapter();
  }

  if (process.env['OPENAI_API_KEY'] && process.env['OPENAI_API_KEY'].trim().length > 0) {
    return new OpenAILLMAdapter();
  }

  if (process.env['USE_OLLAMA'] === 'true' || process.env['OLLAMA_BASE_URL']) {
    return new OllamaLLMAdapter();
  }

  return undefined;
}
