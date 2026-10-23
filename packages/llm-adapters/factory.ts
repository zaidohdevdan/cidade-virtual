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
 * 1. USE_OLLAMA=true ou OLLAMA_BASE_URL -> OllamaLLMAdapter (gratuito, padrão do MVP)
 * 2. Apenas com ALLOW_PAID_LLM=true: GEMINI_API_KEY -> Gemini, OPENAI_API_KEY -> OpenAI
 * 3. undefined se nenhuma credencial for detectada (mantendo o modo local gracioso).
 */
export function createDefaultLLMAdapter(options?: AutoLLMAdapterOptions): LLMProviderAdapter | undefined {
  const prefer = options?.prefer;

  const paid = process.env['ALLOW_PAID_LLM'] === 'true';
  if (prefer === 'gemini' && paid && process.env['GEMINI_API_KEY']) {
    return new GeminiLLMAdapter();
  }
  if (prefer === 'openai' && paid && process.env['OPENAI_API_KEY']) {
    return new OpenAILLMAdapter();
  }
  if (prefer === 'ollama' && process.env['OLLAMA_BASE_URL']) {
    return new OllamaLLMAdapter();
  }

  // MVP sem custo: Ollama (local/gratuito) é o padrão. Provedores pagos só com opt-in explícito.
  if (process.env['USE_OLLAMA'] === 'true' || process.env['OLLAMA_BASE_URL']) {
    return new OllamaLLMAdapter();
  }

  if (process.env['ALLOW_PAID_LLM'] === 'true') {
    if (process.env['GEMINI_API_KEY'] && process.env['GEMINI_API_KEY'].trim().length > 0) {
      return new GeminiLLMAdapter();
    }
    if (process.env['OPENAI_API_KEY'] && process.env['OPENAI_API_KEY'].trim().length > 0) {
      return new OpenAILLMAdapter();
    }
  }

  return undefined;
}
