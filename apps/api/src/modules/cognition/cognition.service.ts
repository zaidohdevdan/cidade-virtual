import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import type { AgentAction, CitizenId, MemorySnippet } from '@cidade-virtual/types';
import { CognitiveCycleManager } from '@cidade-virtual/agent-cognition';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import {
  GoalPlanner,
  type Plan,
  AgentMind,
  type AgentMindConfig,
  type Vec3,
  type Percept,
  type PerceivedActor,
  type TrafficLight,
  SYNAPSE_WORLD_ENTITIES,
  distance2D,
} from '@cidade-virtual/agent-planning';
import { ExperienceRepository } from '@cidade-virtual/persistence';
import { defaultLogger, metrics, cognitiveAudit } from '@cidade-virtual/observability';
import { MemoryService } from '../memory/memory.service';

export interface CognitiveContext {
  citizenId: CitizenId;
  currentObservation: string;
  nearbyObjects: string[];
  activeGoal?: string;
  currentPosition?: Vec3;
  percept?: Percept;
  mind?: AgentMind;
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
  private readonly minds = new Map<string, AgentMind>();
  private readonly syncedAgentsWithDb = new Set<string>();

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
   * Retorna o CognitiveCycleManager (instrumentação e auditoria do ciclo).
   */
  getCognitiveManager(): CognitiveCycleManager {
    return this.cognitiveManager;
  }

  /**
   * Registra a mente subjetiva de um habitante (AgentMind) no serviço de cognição.
   */
  registerMind(mind: AgentMind): void {
    this.minds.set(mind.id, mind);
  }

  /**
   * Obtém a mente ativa de um habitante caso já registrada.
   */
  getMind(citizenId: string): AgentMind | undefined {
    return this.minds.get(citizenId);
  }

  /**
   * Obtém ou inicializa transparentemente uma mente autônoma para o habitante.
   */
  getOrCreateMind(citizenId: string, customConfig?: Partial<AgentMindConfig>): AgentMind {
    let mind = this.minds.get(citizenId);
    if (!mind) {
      mind = new AgentMind({
        id: citizenId,
        name: customConfig?.name ?? citizenId,
        role: customConfig?.role ?? 'citizen',
        biography: customConfig?.biography ?? 'Habitante autônomo da cidade virtual',
        personality: customConfig?.personality ?? {
          openness: 0.7,
          conscientiousness: 0.6,
          extraversion: 0.6,
          agreeableness: 0.7,
          neuroticism: 0.3,
        },
        initialNeeds: customConfig?.initialNeeds,
        initialMemory: customConfig?.initialMemory,
      });
      this.minds.set(citizenId, mind);
    }
    return mind;
  }

  /**
   * Sincroniza ativamente experiências consolidadas do PostgreSQL para a mente do habitante (Task-039).
   */
  async syncExperiences(citizenId: string): Promise<void> {
    if (!this.expRepo) return;
    const mind = this.getOrCreateMind(citizenId);
    try {
      const persistedExps = await this.expRepo.getByAgentId(citizenId, 50);
      if (persistedExps.length > 0) {
        mind.integrateExperiences(persistedExps as any);
      }
      this.syncedAgentsWithDb.add(citizenId);
    } catch (err) {
      this.logger.warn(`Falha ao sincronizar experiências para ${citizenId}: ${(err as Error).message}`);
    }
  }

  /**
   * Executa o ciclo cognitivo deliberativo unificado (Task-038: Cérebro Único):
   * 1. Recupera memórias semânticas pertinentes no Qdrant
   * 2. Planeja hierarquicamente via GoalPlanner (se houver objetivo ativo)
   * 3. Orquestra a deliberação EXCLUSIVAMENTE via AgentMind.decideNextIntention (+ llm-deliberator)
   * 4. Instrumenta e audita a decisão via cognitiveAudit e telemetria
   * 5. Persiste a experiência em agent_experiences (PostgreSQL)
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

    // 2. Planejamento hierárquico estruturado via GoalPlanner (se houver meta explícita)
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

    // 3. Orquestração exclusiva via AgentMind (Task-038: Cérebro Único)
    const mind = context.mind ?? this.getOrCreateMind(context.citizenId);

    // 3.1 Integração de memórias semânticas e experiências consolidadas na mente (Task-039)
    if (relevantMemories.length > 0) {
      mind.integrateExperiences(relevantMemories as any);
    }
    if (this.expRepo && !this.syncedAgentsWithDb.has(context.citizenId)) {
      try {
        const persistedExps = await this.expRepo.getByAgentId(context.citizenId, 30);
        if (persistedExps.length > 0) {
          mind.integrateExperiences(persistedExps as any);
        }
        this.syncedAgentsWithDb.add(context.citizenId);
      } catch (err) {
        this.logger.warn(
          `Falha ao sincronizar experiências do PostgreSQL para ${context.citizenId}: ${(err as Error).message}`,
        );
      }
    }

    const currentPos: Vec3 = context.currentPosition ?? { x: 0, y: 0.19, z: 0 };
    const perceivedEntities = SYNAPSE_WORLD_ENTITIES.map((e) => ({
      entity: e,
      distance: distance2D(currentPos, e.approach ?? e.position),
    }));

    const perceivedActors: PerceivedActor[] = [];
    const isPlayerNearby = (context.nearbyObjects ?? []).some((obj) =>
      /daniel|avatar|player/i.test(obj),
    );
    if (isPlayerNearby) {
      perceivedActors.push({
        id: 'avatar-daniel',
        name: 'Daniel',
        kind: 'player',
        position: { x: currentPos.x + 1.5, y: currentPos.y ?? 0.19, z: currentPos.z + 1.5 },
        distance: 2.0,
      });
    }

    const trafficLight: TrafficLight = /vermelho|red/i.test(context.currentObservation) ? 'red' : 'green';

    const percept: Percept = context.percept ?? {
      position: currentPos,
      entities: perceivedEntities,
      actors: perceivedActors,
      trafficLight,
    };

    if (options?.forceLLM && this.llmAdapter) {
      metrics.increment('llm.calls');
    }

    const intention = await mind.decideNextIntention(
      currentPos,
      percept,
      this.llmAdapter,
      {
        forceLLM: options?.forceLLM,
      },
    );

    const isLLM = intention.source === 'llm';
    const actionType = isLLM
      ? 'llm_deliberated_action'
      : (intention.candidate.affordance || 'autonomous_navigation');
    const reasonCode = isLLM ? 'LLM_REASONING' : 'UTILITY_DECISION';

    const action: AgentAction = {
      agentId: context.citizenId,
      actionType,
      targetId: intention.candidate.targetId,
      parameters: {
        destination: intention.candidate.destination,
        targetLabel: intention.candidate.targetLabel,
        affordance: intention.candidate.affordance,
        score: intention.candidate.score,
        source: intention.source,
        speech: intention.speech,
        observation: context.currentObservation,
        retrievedMemoriesCount: relevantMemories.length,
        ...(activePlan
          ? {
              activePlanId: activePlan.id,
              activePlanStrategy: activePlan.strategy,
              activePlanStepsCount: activePlan.steps.length,
            }
          : {}),
      },
      reasonCode,
      expectedOutcome: intention.reason,
    };

    // 4. Instrumentação e auditoria do ciclo via CognitiveCycleManager / cognitiveAudit
    cognitiveAudit.logDecision(
      context.citizenId,
      action,
      reasonCode,
      isLLM ? 0.95 : 0.85,
    );

    // 5. Persistência do resultado da ação em agent_experiences (PostgreSQL)
    if (this.expRepo) {
      try {
        await this.expRepo.record({
          agentId: context.citizenId,
          eventType: 'action_result',
          description: `Ação deliberada: ${action.actionType} (${action.reasonCode}) -> ${action.expectedOutcome}`,
          sourceType: 'action_result',
          confidence: '1.00',
          importance: '0.70',
          relatedEntityIds: context.nearbyObjects ?? [],
          metadata: {
            actionType: action.actionType,
            reasonCode: action.reasonCode,
            expectedOutcome: action.expectedOutcome,
            observation: context.currentObservation,
            memoriesConsulted: relevantMemories.length,
            intentionSource: intention.source,
            affordance: intention.candidate.affordance,
          },
        });
      } catch (err) {
        this.logger.error(`Erro ao persistir action_result no banco: ${(err as Error).message}`);
      }
    }

    // 6. Auditoria de telemetria estruturada
    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[AUDIT] [COGNITION] Habitante ${context.citizenId} decidiu ação '${action.actionType}' (motivo: ${action.reasonCode}) em ${durationMs}ms`,
    );

    defaultLogger.audit('COGNITIVE_CYCLE_COMPLETED', context.citizenId, {
      actionType: action.actionType,
      reasonCode: action.reasonCode,
      durationMs,
      memoriesUsed: relevantMemories.length,
      intentionSource: intention.source,
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

