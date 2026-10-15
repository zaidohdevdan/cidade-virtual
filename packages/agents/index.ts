// packages/agents/index.ts
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import type { MemoryService } from '@cidade-virtual/memory';
import type { CitizensService, WorldService } from '@cidade-virtual/api/services';
import {
  createCitizenTool,
  triggerEventTool,
  getNPCMemoryTool,
  setEmotionStateTool,
  requestHumanReviewTool,
  weatherSetConditionTool,
  npcBroadcastAlertTool,
  getSceneSnapshotTool,
} from '@cidade-virtual/api/tools';

export interface AntigravityAgentContext {
  citizens: CitizensService;
  world?: WorldService;
  scenarios?: WorldService;
  memory: MemoryService;
  llmAdapter?: LLMProviderAdapter;
  riskLevel: 'operational' | 'structural' | 'existential';
}

export interface AgentRunResult {
  output: string;
  intermediateSteps: Array<{
    tool: string;
    input: unknown;
    output: unknown;
  }>;
}

import type { ToolDefinition } from '@cidade-virtual/tools';

export class AntigravityAgent {
  private ctx: AntigravityAgentContext;
  private tools: ToolDefinition<any, any>[];

  constructor(ctx: AntigravityAgentContext) {
    this.ctx = ctx;
    const worldService = (ctx.world ?? ctx.scenarios)!;

    this.tools = [
      createCitizenTool(ctx.citizens),
      triggerEventTool(worldService),
      getNPCMemoryTool(ctx.memory),
      setEmotionStateTool(ctx.citizens),
      requestHumanReviewTool(ctx.citizens),
      weatherSetConditionTool(worldService),
      npcBroadcastAlertTool(ctx.citizens),
      getSceneSnapshotTool(worldService),
    ];
  }

  getTools() {
    return this.tools;
  }

  async run(input: string): Promise<AgentRunResult> {
    const systemPrompt = `Você é o Agente Antigravity, parceiro de implementação e operação do projeto
"Cidade Virtual de IAs Humanizadas". Daniel é o Arquiteto Chefe e Supervisor Ético.
NÍVEL DE DECISÃO ATUAL: ${this.ctx.riskLevel.toUpperCase()}`;

    if (this.ctx.llmAdapter) {
      const response = await this.ctx.llmAdapter.complete({
        prompt: input,
        systemPrompt,
      });

      return {
        output: response.content,
        intermediateSteps: [],
      };
    }

    return {
      output: `[AntigravityAgent: ${this.ctx.riskLevel}] Ação processada para: ${input}`,
      intermediateSteps: [],
    };
  }
}

export async function buildAntigravityAgent(ctx: AntigravityAgentContext) {
  return new AntigravityAgent(ctx);
}
