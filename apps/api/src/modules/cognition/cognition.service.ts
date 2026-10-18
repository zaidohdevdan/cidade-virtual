// apps/api/src/modules/cognition/cognition.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import type { AgentAction, CitizenId, MemorySnippet } from '@cidade-virtual/types';
import { CognitiveCycleManager } from '@cidade-virtual/agent-cognition';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
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

  constructor(
    private readonly memoryService: MemoryService,
    @Optional() private readonly expRepo?: ExperienceRepository,
    @Optional() llmAdapter?: LLMProviderAdapter,
  ) {
    this.cognitiveManager = new CognitiveCycleManager(llmAdapter);
  }

  /**
   * Permite reconfigurar ou injetar dinamicamente um LLMProviderAdapter.
   */
  setLLMAdapter(adapter?: LLMProviderAdapter): void {
    this.cognitiveManager = new CognitiveCycleManager(adapter);
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

    const fullContext = [
      ...memoryContexts,
      `Objetivo Ativo: ${context.activeGoal ?? 'manter rotina urbana segura'}`,
      ...(context.nearbyObjects.length ? [`Objetos Próximos: ${context.nearbyObjects.join(', ')}`] : []),
    ];

    // 2. Avaliação da ação através do CognitiveCycleManager
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
}
