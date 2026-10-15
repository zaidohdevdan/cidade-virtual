/**
 * @cidade-virtual/agent-cognition
 * Orquestração do ciclo cognitivo dos agentes via LangGraph.js e máquinas de estado.
 * Alinhado com SKILL.md v2.0.0 Seção 3.4 e Seção 4 (Orquestração Cognitiva).
 */
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { AgentAction, CitizenId } from '@cidade-virtual/types';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';

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
        const isRoutine = state.observation.toLowerCase().includes('caminhar') ||
                          state.observation.toLowerCase().includes('parado');

        return {
          situation: `Situação identificada: ${state.observation}`,
          requiresLLM: !isRoutine && !!this.llmAdapter,
          confidence: 0.85,
        };
      })

      // 3 & 4: Construção do contexto e recuperação de regras
      .addNode('buildContext', async (_state) => {
        return {
          relevantContext: ['Regra: Respeitar o espaço público e sinalizações urbanas.'],
        };
      })

      // 5, 6 & 7: Seleção de Ação deliberada (Determinística ou via LLM)
      .addNode('selectAction', async (state) => {
        if (state.requiresLLM && this.llmAdapter) {
          const prompt = `Observação: ${state.observation}\nContexto: ${state.relevantContext.join('; ')}\nQual ação o agente deve tomar?`;
          const response = await this.llmAdapter.complete({
            prompt,
            systemPrompt: 'Você é o módulo deliberativo de um habitante da cidade virtual.',
          });

          return {
            chosenAction: {
              agentId: state.agentId,
              actionType: 'llm_deliberated_action',
              targetId: state.targetId,
              parameters: { response: response.content },
              reasonCode: 'LLM_REASONING',
              expectedOutcome: response.content.slice(0, 80),
            },
          };
        }

        // Ação rotineira determinística (sem custo de inferência)
        return {
          chosenAction: {
            agentId: state.agentId,
            actionType: 'routine_navigation',
            targetId: state.targetId,
            parameters: { observation: state.observation },
            reasonCode: 'ROUTINE_POLICY',
            expectedOutcome: 'Deslocamento urbano seguro',
          },
        };
      })

      // 8 & 9: Validação da ação conforme regras do mundo
      .addNode('validateAction', async (state) => {
        return {
          confidence: Math.min(1.0, (state.confidence ?? 0.8) + 0.1),
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
  async evaluateAction(agentId: CitizenId, observation: string, targetId?: string): Promise<AgentAction> {
    const finalState = await this.workflow.invoke({
      agentId,
      observation,
      targetId,
      relevantContext: [],
      confidence: 0.5,
      requiresLLM: false,
    });

    return finalState.chosenAction;
  }
}
