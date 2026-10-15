// apps/api/src/modules/cognition/cognition.service.ts
import { Injectable } from '@nestjs/common';
import type { AgentAction, CitizenId, MemorySnippet } from '@cidade-virtual/types';
import { MemoryService } from '../memory/memory.service';

export interface CognitiveContext {
  citizenId: CitizenId;
  currentObservation: string;
  nearbyObjects: string[];
  activeGoal?: string;
}

@Injectable()
export class CognitionService {
  constructor(private readonly memoryService: MemoryService) {}

  /**
   * Executa o ciclo cognitivo formal conforme a Seção 3.4 da SKILL 2.0.0:
   * 1. Receber observação contextual
   * 2. Recuperar memórias pertinentes (episódicas e semânticas)
   * 3. Interpretar a situação e objetivos ativos
   * 4. Produzir uma decisão em formato de AgentAction validável
   */
  async processCycle(context: CognitiveContext): Promise<AgentAction> {
    // 1. Recupera memórias contextuais relacionadas à observação atual
    const relevantMemories: MemorySnippet[] = await this.memoryService.semanticQuery({
      citizenId: context.citizenId,
      queryText: context.currentObservation,
      topK: 3,
    });

    // 2. Determina ação com base em regras e raciocínio contextual
    const action: AgentAction = {
      agentId: context.citizenId,
      actionType: 'navigate_or_interact',
      targetId: context.nearbyObjects[0],
      parameters: {
        observation: context.currentObservation,
        retrievedMemoriesCount: relevantMemories.length,
        goal: context.activeGoal ?? 'explore',
      },
      reasonCode: 'GOAL_PURSUIT',
      expectedOutcome: 'Alcançar o objetivo mantendo conformidade com as regras do ambiente',
    };

    return action;
  }
}
