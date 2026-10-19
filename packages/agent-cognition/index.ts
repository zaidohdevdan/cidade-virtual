/**
 * @cidade-virtual/agent-cognition
 * Orquestração do ciclo cognitivo dos agentes via LangGraph.js e máquinas de estado.
 * Alinhado com SKILL.md v2.0.0 Seção 3.4 e Seção 4 (Orquestração Cognitiva).
 */
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { AgentAction, CitizenId, ActionRequest, Principal } from '@cidade-virtual/types';
import { createPrincipal } from '@cidade-virtual/types';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import { metrics, cognitiveAudit } from '@cidade-virtual/observability';

/**
 * Estado cognitivo do agente manipulado pelo grafo de decisão.
 */
export const CognitiveStateAnnotation = Annotation.Root({
  agentId: Annotation<CitizenId>(),
  observation: Annotation<string>(),
  situation: Annotation<string>(),
  targetId: Annotation<string | undefined>(),
  relevantContext: Annotation<string[]>({
    reducer: (curr, update) => [...(curr ?? []), ...(update ?? [])],
    default: () => [],
  }),
  chosenAction: Annotation<AgentAction>(),
  confidence: Annotation<number>(),
  requiresLLM: Annotation<boolean>(),
});

export type CognitiveState = typeof CognitiveStateAnnotation.State;

export interface EvaluateActionOptions {
  relevantContext?: string[];
  forceLLM?: boolean;
}

export class CognitiveCycleManager {
  private workflow;
  private llmAdapter?: LLMProviderAdapter;

  constructor(llmAdapter?: LLMProviderAdapter) {
    this.llmAdapter = llmAdapter;
    this.workflow = this.buildGraph().compile();
  }

  private buildGraph() {
    return new StateGraph(CognitiveStateAnnotation)
      // 1 & 2: Interpretação da situação a partir do estímulo percebido
      .addNode('interpretSituation', async (state) => {
        const obsLower = state.observation.toLowerCase();
        const isRoutine = obsLower.includes('caminha') ||
                          obsLower.includes('parado') ||
                          obsLower.includes('aguarda') ||
                          obsLower.includes('patrulha') ||
                          obsLower.includes('verde') ||
                          obsLower.includes('trabalho') ||
                          obsLower.includes('rotina');

        const needsDeliberation = state.requiresLLM || (!isRoutine && (state.confidence ?? 0.5) < 0.7);

        return {
          situation: `Situação identificada: ${state.observation}`,
          requiresLLM: needsDeliberation && !!this.llmAdapter,
          confidence: isRoutine ? 0.85 : (state.confidence ?? 0.6),
        };
      })

      // 3 & 4: Construção do contexto e recuperação de regras
      .addNode('buildContext', async (state) => {
        const urbanRule = 'Regra: Respeitar o espaço público, faixa de pedestres e sinalizações urbanas.';
        const merged = [urbanRule, ...(state.relevantContext ?? [])];
        return {
          relevantContext: merged,
        };
      })

      // 5, 6 & 7: Seleção de Ação deliberada (Determinística ou via LLM)
      .addNode('selectAction', async (state) => {
        if (state.requiresLLM && this.llmAdapter) {
          metrics.increment('llm.calls');
          const prompt = `Observação: ${state.observation}\nContexto: ${state.relevantContext.join('; ')}\nQual ação o agente deve tomar?`;
          const response = await this.llmAdapter.complete({
            prompt,
            systemPrompt: 'Você é o módulo deliberativo de um habitante da cidade virtual.',
          });

          const action: AgentAction = {
            agentId: state.agentId,
            actionType: 'llm_deliberated_action',
            targetId: state.targetId,
            parameters: {
              response: response.content,
              contextCount: state.relevantContext.length,
            },
            reasonCode: 'LLM_REASONING',
            expectedOutcome: response.content.slice(0, 80),
          };

          return { chosenAction: action };
        }

        // Ação rotineira determinística (sem custo de inferência)
        const routineAction: AgentAction = {
          agentId: state.agentId,
          actionType: 'routine_navigation',
          targetId: state.targetId,
          parameters: {
            observation: state.observation,
            contextCount: state.relevantContext.length,
          },
          reasonCode: 'ROUTINE_POLICY',
          expectedOutcome: 'Deslocamento urbano seguro conforme normas de trânsito',
        };

        return { chosenAction: routineAction };
      })

      // 8 & 9: Validação da ação conforme regras do mundo
      .addNode('validateAction', async (state) => {
        const boostedConfidence = Math.min(1.0, (state.confidence ?? 0.8) + 0.1);
        if (state.chosenAction) {
          cognitiveAudit.logDecision(
            state.agentId,
            state.chosenAction,
            state.chosenAction.reasonCode ?? 'POLICY',
            boostedConfidence,
          );
        }

        return {
          confidence: boostedConfidence,
        };
      })

      // Definição das arestas do ciclo cognitivo
      .addEdge(START, 'interpretSituation')
      .addEdge('interpretSituation', 'buildContext')
      .addEdge('buildContext', 'selectAction')
      .addEdge('selectAction', 'validateAction')
      .addEdge('validateAction', END);
  }

  /**
   * Avalia uma observação e executa o ciclo cognitivo do agente através do grafo.
   */
  async evaluateAction(
    agentId: CitizenId,
    observation: string,
    targetId?: string,
    options?: EvaluateActionOptions,
  ): Promise<AgentAction> {
    const finalState = await this.workflow.invoke({
      agentId,
      observation,
      targetId,
      relevantContext: options?.relevantContext ?? [],
      confidence: options?.forceLLM ? 0.4 : 0.5,
      requiresLLM: options?.forceLLM ?? false,
    });

    return finalState.chosenAction;
  }

  /**
   * Avalia a observação e emite um ActionRequest canônico assinado pelo Principal do NPC (Task-025).
   */
  async evaluateActionRequest(
    agentId: CitizenId,
    observation: string,
    targetId?: string,
    options?: EvaluateActionOptions,
  ): Promise<ActionRequest> {
    const action = await this.evaluateAction(agentId, observation, targetId, options);
    const principal = createPrincipal({
      id: `principal_${agentId}`,
      type: 'npc',
      roles: ['citizen'],
      agentId,
      displayName: `NPC ${agentId}`,
    });

    return {
      principal,
      actionType: action.actionType,
      targetId: action.targetId,
      parameters: action.parameters,
      reasonCode: action.reasonCode,
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}
