// packages/llm-adapters/index.ts
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  tokenCount?: number;
  latencyMs?: number;
}

export interface LLMProviderAdapter {
  complete(req: LLMRequest): Promise<LLMResponse>;
  isConfigured?(): boolean;
  getModel?(): string;
}

export * from './gemini-adapter.js';
export * from './openai-adapter.js';
export * from './ollama-adapter.js';
export * from './factory.js';
