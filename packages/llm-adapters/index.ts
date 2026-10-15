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
}
