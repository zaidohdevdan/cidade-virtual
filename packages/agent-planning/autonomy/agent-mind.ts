// packages/agent-planning/autonomy/agent-mind.ts
// Mente viva e estado subjetivo de cada habitante: gerencia necessidades contínuas,
// histórico de visitas, intenção ativa e execução temporal de atividades sem nenhum script pré-fixado.

import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import {
  type ActionCandidate,
  type ActivityState,
  type Intention,
  type Needs,
  type Percept,
  type Personality,
  type Vec3,
} from './types.js';
import {
  AFFORDANCE_DURATION_TICKS,
  AFFORDANCE_EFFECTS,
  applyEffect,
  createInitialNeeds,
  decayNeeds,
  wellbeing,
} from './needs.js';
import {
  distance2D,
  generateCandidates,
  rankCandidates,
  type MemoryContext,
  type DeciderOptions,
} from './utility-decider.js';
import { deliberateWithLLM } from './llm-deliberator.js';

export interface AgentMindConfig {
  id: string;
  name: string;
  role: string;
  biography: string;
  personality: Personality;
  initialNeeds?: Needs;
  rng?: () => number;
}

export class AgentMind {
  public readonly id: string;
  public readonly name: string;
  public readonly role: string;
  public readonly biography: string;
  public readonly personality: Personality;

  public needs: Needs;
  public memory: MemoryContext;
  public currentIntention: Intention | null = null;
  public currentActivity: ActivityState | null = null;

  private readonly rng: () => number;

  constructor(config: AgentMindConfig) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.biography = config.biography;
    this.personality = config.personality;
    this.rng = config.rng ?? Math.random;

    this.needs = config.initialNeeds ?? createInitialNeeds(this.rng);
    this.memory = {
      lastVisitedAt: {},
      visitCounts: {},
      actorAffinity: {},
    };
  }

  /**
   * Atualiza as necessidades internas pelo decaimento temporal
   * e processa ticks de atividades em andamento (ex.: sentar no banco, tomar café).
   */
  public update(dtSeconds: number): { activityFinished?: ActivityState } {
    this.needs = decayNeeds(this.needs, this.personality, dtSeconds);

    if (this.currentActivity) {
      this.currentActivity.remainingTicks--;
      if (this.currentActivity.remainingTicks <= 0) {
        const finished = this.currentActivity;
        this.completeActivity(finished);
        this.currentActivity = null;
        return { activityFinished: finished };
      }
    }

    return {};
  }

  /**
   * Decide a próxima intenção autônoma a partir do que o agente percebe.
   */
  public async decideNextIntention(
    currentPos: Vec3,
    percept: Percept,
    llm?: LLMProviderAdapter,
    options: DeciderOptions = {},
  ): Promise<Intention> {
    const candidates = generateCandidates(currentPos, percept);

    // Se por alguma razão o raio não tiver nada, fallback de exploração
    if (candidates.length === 0) {
      candidates.push({
        id: 'explore:default',
        affordance: 'explore',
        targetId: 'praca-central',
        targetLabel: 'Praça Central',
        targetKind: 'place',
        destination: { x: -22, y: 0.19, z: 22 },
        distance: distance2D(currentPos, { x: -22, z: 22 }),
        quality: 1.0,
        score: 0.5,
      });
    }

    const ranked = rankCandidates(
      candidates,
      this.needs,
      this.personality,
      this.memory,
      { ...options, rng: this.rng },
    );

    // Detecta presença do jogador avatar (Daniel) próximo
    const playerActor = percept.actors.find((a) => a.kind === 'player');
    const playerNearby = !!playerActor && playerActor.distance <= 3.5;

    // Se o jogador estiver muito próximo, ou se o top 2 estiver quase empatado e tivermos LLM
    const topDiff = ranked.length >= 2 ? ranked[0].score - ranked[1].score : 1.0;
    const shouldInvokeLLM = !!llm && (playerNearby || topDiff < 0.12);

    let resultIntention: Intention;

    if (shouldInvokeLLM) {
      const deliberation = await deliberateWithLLM(llm, {
        agentId: this.id,
        agentName: this.name,
        role: this.role,
        biography: this.biography,
        personality: this.personality,
        needs: this.needs,
        trafficLight: percept.trafficLight,
        candidates: ranked,
        playerNearby,
        playerDistance: playerActor?.distance,
        lastAction: this.currentIntention?.candidate.affordance,
      });

      resultIntention = {
        candidate: deliberation.candidate,
        reason: deliberation.reason,
        source: deliberation.source,
        decidedAt: Date.now(),
        speech: deliberation.speech,
      };
    } else {
      const best = ranked[0];
      resultIntention = {
        candidate: best,
        reason: `Decisão autônoma: escolhi ${best.targetLabel} para ${best.affordance} (utilidade: ${best.score.toFixed(2)}).`,
        source: 'utility',
        decidedAt: Date.now(),
      };
    }

    this.currentIntention = resultIntention;
    return resultIntention;
  }

  /**
   * Chamado quando o corpo do agente alcança o destino da intenção.
   * Inicia a atividade correspondente à affordance.
   */
  public startArrivalActivity(candidate: ActionCandidate): void {
    const totalTicks = AFFORDANCE_DURATION_TICKS[candidate.affordance] ?? 2;
    this.currentActivity = {
      candidate,
      remainingTicks: totalTicks,
      totalTicks,
      wellbeingBefore: wellbeing(this.needs, this.personality),
    };
  }

  /**
   * Conclui a atividade, aplica os efeitos físicos nas necessidades
   * e registra a experiência na memória pessoal.
   */
  private completeActivity(activity: ActivityState): void {
    const effect = AFFORDANCE_EFFECTS[activity.candidate.affordance];
    if (effect) {
      this.needs = applyEffect(this.needs, effect);
    }

    // Registra visita para anti-repetição
    const candId = activity.candidate.id;
    const targetId = activity.candidate.targetId;
    this.memory.lastVisitedAt = this.memory.lastVisitedAt || {};
    this.memory.lastVisitedAt[candId] = Date.now();

    this.memory.visitCounts = this.memory.visitCounts || {};
    this.memory.visitCounts[targetId] = (this.memory.visitCounts[targetId] || 0) + 1;
  }

  /**
   * Ajusta o nível de afinidade com outro habitante ou com o avatar Daniel.
   */
  public recordSocialInteraction(actorId: string, positive: boolean): void {
    this.memory.actorAffinity = this.memory.actorAffinity || {};
    const curr = this.memory.actorAffinity[actorId] ?? 0.5;
    const delta = positive ? 0.08 : -0.15;
    this.memory.actorAffinity[actorId] = Math.max(0, Math.min(1, curr + delta));
  }
}
