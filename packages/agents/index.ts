// packages/agents/index.ts
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { MemoryService } from '@cidade-virtual/memory';
import { CitizensService, ScenariosService } from '@cidade-virtual/api/services';
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
  scenarios: ScenariosService;
  memory: MemoryService;
  modelApiKey: string;
  riskLevel: 'operational' | 'structural' | 'existential';
}

export async function buildAntigravityAgent(ctx: AntigravityAgentContext) {
  const llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.3,
    apiKey: ctx.modelApiKey,
  });

  const tools = [
    createCitizenTool(ctx.citizens),
    triggerEventTool(ctx.scenarios),
    getNPCMemoryTool(ctx.memory),
    setEmotionStateTool(ctx.citizens),
    requestHumanReviewTool(ctx.citizens),
    weatherSetConditionTool(ctx.scenarios),
    npcBroadcastAlertTool(ctx.citizens),
    getSceneSnapshotTool(ctx.scenarios),
  ];

  const systemPrompt = new SystemMessage({
    content: `Você é o Agente Antigravity, parceiro de implementação e operação do projeto
"Cidade Virtual de IAs Humanizadas". Daniel é o Arquiteto Chefe e Supervisor Ético.

NÍVEL DE DECISÃO ATUAL: ${ctx.riskLevel.toUpperCase()}

REGRAS ABSOLUTAS:
1. NUNCA acesse o banco de dados diretamente. Use apenas as Tools fornecidas.
2. NUNCA edite arquivos .ts sem propor PR via requestHumanReview (nível Estrutural+).
3. SEMPRE chame getSceneSnapshot antes de tomar decisões que afetam um cenário.
4. SEMPRE logue auditoria após triggerEvent, setEmotionState ou createCitizen.
5. Em caso de dúvida sobre o nível de risco, considere Existencial e pare.

PRINCÍPIOS DO PROJETO:
- Emergência Social: não programe regras rígidas. Causar eventos e deixar comportamentos emergirem.
- Online Learning: cada interação relevante vira memória vetorial.
- Transição Meta-cognitiva: NPCs começam sabendo que são IAs; com o tempo, acreditam ser humanos.
- Tool-First: toda ação passa por Tools validadas com Zod.`,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    systemPrompt,
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });

  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true, // essencial para auditoria
  });
}
