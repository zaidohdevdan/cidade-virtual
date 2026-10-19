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
  initialMemory?: MemoryContext;
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
    this.memory = config.initialMemory
      ? {
          lastVisitedAt: { ...(config.initialMemory.lastVisitedAt ?? {}) },
          visitCounts: { ...(config.initialMemory.visitCounts ?? {}) },
          actorAffinity: { ...(config.initialMemory.actorAffinity ?? {}) },
          placePreferences: { ...(config.initialMemory.placePreferences ?? {}) },
          suggestedTargets: { ...(config.initialMemory.suggestedTargets ?? {}) },
        }
      : {
          lastVisitedAt: {},
          visitCounts: {},
          actorAffinity: {},
          placePreferences: {},
          suggestedTargets: {},
        };
  }

  /**
   * Serializa o estado psicológico e hedônico completo para persistência relacional (Task-036).
   */
  public serializeState(): {
    agentId: string;
    needs: Needs;
    memory: MemoryContext;
    currentIntention: Intention | null;
    currentActivity: ActivityState | null;
  } {
    return {
      agentId: this.id,
      needs: { ...this.needs },
      memory: {
        lastVisitedAt: { ...this.memory.lastVisitedAt },
        visitCounts: { ...this.memory.visitCounts },
        actorAffinity: { ...(this.memory.actorAffinity ?? {}) },
        placePreferences: { ...(this.memory.placePreferences ?? {}) },
        suggestedTargets: { ...(this.memory.suggestedTargets ?? {}) },
      },
      currentIntention: this.currentIntention ? JSON.parse(JSON.stringify(this.currentIntention)) : null,
      currentActivity: this.currentActivity ? JSON.parse(JSON.stringify(this.currentActivity)) : null,
    };
  }

  /**
   * Restaura o estado da mente a partir do snapshot persistido no PostgreSQL (Task-036).
   */
  public restoreState(state: {
    needs?: Needs;
    memory?: MemoryContext;
    currentIntention?: Intention | null;
    currentActivity?: ActivityState | null;
  }): void {
    if (state.needs) {
      this.needs = { ...state.needs };
    }
    if (state.memory) {
      this.memory = {
        lastVisitedAt: { ...(state.memory.lastVisitedAt ?? {}) },
        visitCounts: { ...(state.memory.visitCounts ?? {}) },
        actorAffinity: { ...(state.memory.actorAffinity ?? {}) },
        placePreferences: { ...(state.memory.placePreferences ?? {}) },
        suggestedTargets: { ...(state.memory.suggestedTargets ?? {}) },
      };
    }
    if (state.currentIntention !== undefined) {
      this.currentIntention = state.currentIntention;
    }
    if (state.currentActivity !== undefined) {
      this.currentActivity = state.currentActivity;
    }
  }

  /**
   * Atualiza as necessidades internas pelo decaimento temporal,
   * arrefece sugestões recebidas e processa ticks de atividades em andamento.
   */
  public update(dtSeconds: number): { activityFinished?: ActivityState } {
    this.needs = decayNeeds(this.needs, this.personality, dtSeconds);

    // Arrefecimento temporal de sugestões do jogador ou de pares
    if (this.memory.suggestedTargets) {
      for (const k of Object.keys(this.memory.suggestedTargets)) {
        const val = this.memory.suggestedTargets[k];
        if (val > 0) {
          this.memory.suggestedTargets[k] = Math.max(0, val - (dtSeconds / 60) * 0.15);
        }
      }
    }

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
   * Conclui a atividade, aplica os efeitos físicos nas necessidades,
   * atualiza preferências aprendidas pelo local (A10) e registra a visita.
   */
  private completeActivity(activity: ActivityState): void {
    const effect = AFFORDANCE_EFFECTS[activity.candidate.affordance];
    if (effect) {
      this.needs = applyEffect(this.needs, effect);
    }

    // Aprendizado hedônico de preferência do local (A10):
    // Se a atividade aumentou substancialmente o bem-estar do agente,
    // ele aprende que "gosta" deste local e o buscará com maior probabilidade futura
    const wellbeingAfter = wellbeing(this.needs, this.personality);
    const deltaWellbeing = wellbeingAfter - activity.wellbeingBefore;

    const targetId = activity.candidate.targetId;
    this.memory.placePreferences = this.memory.placePreferences || {};
    const currPref = this.memory.placePreferences[targetId] ?? 0;
    this.memory.placePreferences[targetId] = Math.max(-1, Math.min(1, currPref + deltaWellbeing * 0.5));

    // Registra visita para anti-repetição
    const candId = activity.candidate.id;
    this.memory.lastVisitedAt = this.memory.lastVisitedAt || {};
    this.memory.lastVisitedAt[candId] = Date.now();

    this.memory.visitCounts = this.memory.visitCounts || {};
    this.memory.visitCounts[targetId] = (this.memory.visitCounts[targetId] || 0) + 1;
  }

  /**
   * Ajusta o nível de afinidade interpessoal e satisfaz necessidades sociais.
   */
  public recordSocialInteraction(actorId: string, positive: boolean): void {
    this.memory.actorAffinity = this.memory.actorAffinity || {};
    const curr = this.memory.actorAffinity[actorId] ?? 0.5;
    const delta = positive ? 0.08 : -0.15;
    this.memory.actorAffinity[actorId] = Math.max(0, Math.min(1, curr + delta));

    if (positive) {
      this.needs = applyEffect(this.needs, { social: 0.2, fun: 0.05 });
    }
  }

  /**
   * Processa interação recebida do avatar Daniel (A8):
   * Constrói memória afetiva, satisfaz carência social e extrai possíveis
   * estímulos de locais sugeridos na mensagem de Daniel (ex: "vai ao café").
   */
  public receivePlayerInteraction(playerMessage: string): { suggestedEntityId?: string } {
    this.recordSocialInteraction('avatar-daniel', true);

    const lower = playerMessage.toLowerCase();
    this.memory.suggestedTargets = this.memory.suggestedTargets || {};

    let suggestedEntityId: string | undefined;

    if (lower.includes('café') || lower.includes('bistro') || lower.includes('comer') || lower.includes('lanche')) {
      suggestedEntityId = 'cafe-bistro';
    } else if (lower.includes('mercado') || lower.includes('compras') || lower.includes('comprar')) {
      suggestedEntityId = 'market-central';
    } else if (lower.includes('praça') || lower.includes('fonte')) {
      suggestedEntityId = 'fountain-monumental';
    } else if (lower.includes('banco') || lower.includes('descansar') || lower.includes('sentar')) {
      suggestedEntityId = 'bench-praca-west';
    } else if (lower.includes('árvore') || lower.includes('verde') || lower.includes('sombra')) {
      suggestedEntityId = 'tree-boulevard-nw';
    }

    if (suggestedEntityId) {
      this.memory.suggestedTargets[suggestedEntityId] = 0.85;
    }

    return { suggestedEntityId };
  }

  /**
   * Executa interação social direta e espontânea entre dois agentes autônomos (A9):
   * Ambos atualizam afinidade mútua, restauram convívio e trocam saudação.
   */
  public interactWithAgentPeer(peer: AgentMind): { greetingFromSelf: string; replyFromPeer: string } {
    this.recordSocialInteraction(peer.id, true);
    peer.recordSocialInteraction(this.id, true);

    const greetingFromSelf = `Olá ${peer.name}! Tudo bem contigo?`;
    const replyFromPeer = `Oi ${this.name}! Tudo tranquilo por aqui na praça.`;

    return { greetingFromSelf, replyFromPeer };
  }
}
