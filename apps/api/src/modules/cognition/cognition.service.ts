import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import type { AgentAction, CitizenId, MemorySnippet } from '@cidade-virtual/types';
import { CognitiveCycleManager } from '@cidade-virtual/agent-cognition';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import { GoalPlanner, type Plan } from '@cidade-virtual/agent-planning';
import { ExperienceRepository } from '@cidade-virtual/persistence';
import { defaultLogger } from '@cidade-virtual/observability';
import { MemoryService } from '../memory/memory.service';

export interface CognitiveContext {
  citizenId: CitizenId;
  currentObservation: string;
  nearbyObjects: string[];
  activeGoal?: string;
}

export interface ProcessCycleOptions {
  forceLLM?: boolean;
}

@Injectable()
export class CognitionService {
  private readonly logger = new Logger(CognitionService.name);
  private cognitiveManager: CognitiveCycleManager;
  private readonly goalPlanner: GoalPlanner;
  private llmAdapter?: LLMProviderAdapter;

  constructor(
    @Inject(MemoryService) private readonly memoryService: MemoryService,
    @Optional() @Inject(ExperienceRepository) private readonly expRepo?: ExperienceRepository,
    @Optional() @Inject('LLM_ADAPTER') llmAdapter?: LLMProviderAdapter,
  ) {
    this.llmAdapter = llmAdapter;
    this.cognitiveManager = new CognitiveCycleManager(llmAdapter);
    this.goalPlanner = new GoalPlanner({ llmAdapter });
  }

  /**
   * Permite reconfigurar ou injetar dinamicamente um LLMProviderAdapter.
   */
  setLLMAdapter(adapter?: LLMProviderAdapter): void {
    this.llmAdapter = adapter;
    this.cognitiveManager = new CognitiveCycleManager(adapter);
    this.goalPlanner.setLLMAdapter(adapter);
  }

  /**
   * Retorna o adaptador de LLM ativo (se configurado).
   */
  getLLMAdapter(): LLMProviderAdapter | undefined {
    return this.llmAdapter;
  }

  /**
   * Retorna o GoalPlanner associado ao serviço de cognição.
   */
  getGoalPlanner(): GoalPlanner {
    return this.goalPlanner;
  }

  /**
   * Executa o ciclo cognitivo deliberativo conectando percepção, memória vetorial e grafo LangGraph:
   * 1. Recupera memórias semânticas pertinentes no Qdrant
   * 2. Constrói contexto unificado com nearbyObjects e memórias anteriores
   * 3. Executa o grafo cognitivo (LangGraph) para decidir a ação (rotineira ou deliberada via LLM)
   * 4. Persiste a ação decidida no PostgreSQL como experiência do tipo 'action_result'
   * 5. Emite auditoria cognitiva estruturada
   */
  async processCycle(context: CognitiveContext, options?: ProcessCycleOptions): Promise<AgentAction> {
    const startTime = Date.now();

    // 1. Recuperação semântica de memórias relevantes no Qdrant
    let relevantMemories: MemorySnippet[] = [];
    try {
      relevantMemories = await this.memoryService.semanticQuery({
        citizenId: context.citizenId,
        queryText: context.currentObservation,
        topK: 3,
      });
    } catch (err) {
      this.logger.warn(`Falha ao recuperar memórias no Qdrant para ${context.citizenId}: ${(err as Error).message}`);
    }

    const memoryContexts = relevantMemories.map(
      (m) => `[Memória Anterior ${m.memoryType ?? 'geral'}]: ${m.content}`,
    );

    // 2. Planejamento hierárquico estruturado via GoalPlanner
    let activePlan: Plan | undefined;
    if (context.activeGoal) {
      try {
        activePlan = await this.goalPlanner.generatePlan(context.activeGoal, {
          agentId: context.citizenId,
          requiresLLM: options?.forceLLM,
        });
      } catch (err) {
        this.logger.warn(
          `Falha ao gerar plano para objetivo '${context.activeGoal}': ${(err as Error).message}`,
        );
      }
    }

    const fullContext = [
      ...memoryContexts,
      `Objetivo Ativo: ${context.activeGoal ?? 'manter rotina urbana segura'}`,
      ...(activePlan
        ? [
            `Plano Ativo (${activePlan.strategy}, conf: ${activePlan.confidence}): ${activePlan.steps.map((s) => `${s.stepIndex}.${s.action}`).join(' -> ')}`,
          ]
        : []),
      ...(context.nearbyObjects.length ? [`Objetos Próximos: ${context.nearbyObjects.join(', ')}`] : []),
    ];

    // 3. Avaliação da ação através do CognitiveCycleManager
    const targetId = context.nearbyObjects[0];
    const action = await this.cognitiveManager.evaluateAction(
      context.citizenId,
      context.currentObservation,
      targetId,
      {
        relevantContext: fullContext,
        forceLLM: options?.forceLLM,
      },
    );

    action.parameters = {
      ...action.parameters,
      retrievedMemoriesCount: relevantMemories.length,
      ...(activePlan
        ? {
            activePlanId: activePlan.id,
            activePlanStrategy: activePlan.strategy,
            activePlanStepsCount: activePlan.steps.length,
          }
        : {}),
    };

    // 3. Persistência do resultado da ação em agent_experiences (PostgreSQL)
    if (this.expRepo) {
      try {
        await this.expRepo.record({
          agentId: context.citizenId,
          eventType: 'action_result',
          description: `Ação deliberada: ${action.actionType} (${action.reasonCode}) -> ${action.expectedOutcome}`,
          sourceType: 'action_result',
          confidence: '1.00',
          importance: '0.70',
          relatedEntityIds: context.nearbyObjects,
          metadata: {
            actionType: action.actionType,
            reasonCode: action.reasonCode,
            expectedOutcome: action.expectedOutcome,
            observation: context.currentObservation,
            memoriesConsulted: relevantMemories.length,
          },
        });
      } catch (err) {
        this.logger.error(`Erro ao persistir action_result no banco: ${(err as Error).message}`);
      }
    }

    // 4. Auditoria cognitiva estruturada
    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[AUDIT] [COGNITION] Habitante ${context.citizenId} decidiu ação '${action.actionType}' (motivo: ${action.reasonCode}) em ${durationMs}ms`,
    );

    defaultLogger.audit('COGNITIVE_CYCLE_COMPLETED', context.citizenId, {
      actionType: action.actionType,
      reasonCode: action.reasonCode,
      durationMs,
      memoriesUsed: relevantMemories.length,
    });

    return action;
  }

  /**
   * Gera resposta deliberativa conversacional via LLM com base na identidade do habitante,
   * contexto físico (semáforo, horário, etc) e memórias semânticas anteriores.
   * Retorna null se não houver LLM configurado ou se ocorrer erro na inferência,
   * permitindo que o caller use o fallback local gracioso.
   */
  async generateConversationalDialogue(params: {
    citizenId: CitizenId;
    citizenName: string;
    citizenRole: string;
    starDesignation: string;
    backstorySeed: string;
    activeGoals: string[];
    playerMessage: string;
    trafficLight: 'green' | 'yellow' | 'red';
    relevantMemories?: MemorySnippet[];
  }): Promise<string | null> {
    if (!this.llmAdapter) {
      return null;
    }

    try {
      let memories = params.relevantMemories;
      if (!memories) {
        try {
          memories = await this.memoryService.semanticQuery({
            citizenId: params.citizenId,
            queryText: params.playerMessage,
            topK: 3,
          });
        } catch {
          memories = [];
        }
      }

      const memoryLines = memories.map(
        (m, idx) => `- [Memória ${idx + 1}]: ${m.content}`,
      );

      const systemPrompt = `Você é ${params.citizenName} (${params.starDesignation}), habitante com o papel de "${params.citizenRole}" em Synapse City (uma cidade virtual com normas urbanas e convivência cívica).
Biografia e Essência: ${params.backstorySeed}
Objetivos Ativos: ${params.activeGoals.join('; ')}
Estado Viário Atual: O semáforo da Avenida Central está ${params.trafficLight.toUpperCase()}.
Suas Memórias Relevantes:
${memoryLines.length ? memoryLines.join('\n') : '- Nenhuma memória pregressa invocada no momento.'}

Diretrizes Estritas:
1. Responda em Português do Brasil (pt-BR), em primeira pessoa, com a voz e perspectiva do seu papel.
2. Daniel é o avatar do protagonista humano caminhando pela cidade que está conversando com você.
3. Seja conciso (máximo 2 a 3 frases envolventes), mantendo tom expressivo e caloroso.
4. Jamais quebre a imersão de habitante vivo da cidade virtual.`;

      const userPrompt = `Daniel aproximou-se e perguntou: "${params.playerMessage}". Como você responde a ele?`;

      const response = await this.llmAdapter.complete({
        systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });

      const text = response.content?.trim();
      return text || null;
    } catch (err) {
      this.logger.warn(
        `Falha na geração conversacional via LLM para ${params.citizenId}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

