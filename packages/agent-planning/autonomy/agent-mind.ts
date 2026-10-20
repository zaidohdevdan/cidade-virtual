// packages/agent-planning/autonomy/agent-mind.ts
// Mente viva e estado subjetivo de cada habitante: gerencia necessidades contínuas,
// histórico de visitas, intenção ativa e execução temporal de atividades sem nenhum script pré-fixado.

import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import {
  type ActionCandidate,
  type ActivityState,
  type DirectiveType,
  type Intention,
  type LearnedDirective,
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
  type EnvironmentalContext,
} from './needs.js';
import {
  distance2D,
  generateCandidates,
  rankCandidates,
  type MemoryContext,
  type DeciderOptions,
} from './utility-decider.js';
import { deliberateWithLLM } from './llm-deliberator.js';

export const SOCIAL_TRANSMISSION_FACTOR = 0.85;

export interface ExperienceInput {
  id?: string;
  eventType?: string;
  description?: string;
  content?: string;
  locationId?: string | null;
  relatedEntityIds?: readonly string[] | string[];
  importance?: string | number;
  emotionalWeight?: number;
  confidence?: string | number;
  occurredAt?: Date | string | number;
  timestamp?: Date | string | number;
  metadata?: unknown;
  sourceType?: string;
}

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
          learnedDirectives: [...(config.initialMemory.learnedDirectives ?? [])],
        }
      : {
          lastVisitedAt: {},
          visitCounts: {},
          actorAffinity: {},
          placePreferences: {},
          suggestedTargets: {},
          learnedDirectives: [],
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
        learnedDirectives: [...(this.memory.learnedDirectives ?? [])],
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
        learnedDirectives: [...(state.memory.learnedDirectives ?? [])],
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
  public update(dtSeconds: number, env?: EnvironmentalContext): { activityFinished?: ActivityState } {
    this.needs = decayNeeds(this.needs, this.personality, dtSeconds, env);

    // Arrefecimento temporal de sugestões do jogador ou de pares
    if (this.memory.suggestedTargets) {
      for (const k of Object.keys(this.memory.suggestedTargets)) {
        const val = this.memory.suggestedTargets[k];
        if (val > 0) {
          this.memory.suggestedTargets[k] = Math.max(0, val - (dtSeconds / 60) * 0.15);
        }
      }
    }

    // Arrefecimento temporal contínuo das preferências hedônicas (Task-039)
    if (this.memory.placePreferences && Object.keys(this.memory.placePreferences).length > 0) {
      const decay = Math.pow(0.98, Math.max(1, dtSeconds / 60));
      this.coolDownPreferences(decay);
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
      { ...options, percept, rng: this.rng },
    );

    // Detecta presença do jogador avatar (Daniel) próximo
    const playerActor = percept.actors.find((a) => a.kind === 'player');
    const playerNearby = !!playerActor && playerActor.distance <= 3.5;

    // Se forçado ou se o jogador avatar estiver próximo e tivermos LLM disponível
    const shouldInvokeLLM = !!llm && (Boolean(options.forceLLM) || playerNearby);

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
   * Ouve, interpreta, memoriza e executa instruções repassadas pelo avatar Daniel.
   * Modifica a utilidade, registra diretiva permanente em learnedDirectives e
   * ajusta intenções ativas para executar imediatamente sem jamais esquecer.
   */
  public learnAvatarInstruction(playerMessage: string): {
    directive: LearnedDirective;
    confirmationSpeech: string;
    actionRequired?: 'reroute' | 'crosswalk' | 'goto' | 'stop';
  } {
    this.recordSocialInteraction('avatar-daniel', true);
    this.memory.learnedDirectives = this.memory.learnedDirectives || [];
    this.memory.placePreferences = this.memory.placePreferences || {};
    this.memory.suggestedTargets = this.memory.suggestedTargets || {};

    const text = playerMessage.toLowerCase().trim();

    // 1. Detectar instrução de EVITAR local (ex: "vc deve evitar tal lugar", "evite o café", "não vá à praça")
    const isAvoid =
      /evit(ar|e|em)?|não\s+(deve\s+)?(ir|vá|ande|passe)|proibid[oa]|longe\s+d[eo]|fuja\s+d[eo]|saia\s+d[eo]/i.test(
        text,
      );

    // 2. Detectar instrução de ATRAVESSAR PELA FAIXA (ex: "vc deve atravessar a faixa", "use a faixa de pedestre")
    const isCrosswalk =
      /faixa(\s+de\s+pedestre)?|atravess(ar|e|em)?|cruzar|travessia/i.test(text) &&
      !isAvoid;

    // 3. Detectar instrução de IR A UM LOCAL / SUGESTÃO DE DESTINO (ex: "vá para o mercado", "vamos ao café", "que tal irmos ao café")
    const isGoTo =
      /(vá|vai|ir|irmos|vamos|bora|ande|rumo|dirija-se|siga|caminhe)\s+(para|ao|até|na|no|pro|pra)\s+(.+)/i.test(
        text,
      ) && !isAvoid;

    // 4. Detectar instrução de PARAR / ESPERAR (ex: "pare aí", "aguarde na calçada")
    const isStop = /(pare|parar|aguard(e|ar)|espere|fique\s+(aí|parado))/i.test(text);

    let directiveType: DirectiveType = 'custom_rule';
    let targetCategory: string | undefined;
    let targetEntityId: string | undefined;
    let description = '';
    let confirmationSpeech = '';
    let actionRequired: 'reroute' | 'crosswalk' | 'goto' | 'stop' | undefined;

    // Extração de local alvo se houver
    if (text.includes('café') || text.includes('bistro') || text.includes('lanche')) {
      targetCategory = 'cafe';
      targetEntityId = 'cafe-bistro';
    } else if (text.includes('mercado') || text.includes('compras') || text.includes('comprar')) {
      targetCategory = 'market';
      targetEntityId = 'market-central';
    } else if (text.includes('praça') || text.includes('banco') || text.includes('fonte')) {
      targetCategory = 'praca';
      targetEntityId = 'fountain-monumental';
    } else if (text.includes('rua') || text.includes('avenida') || text.includes('asfalto') || text.includes('pista')) {
      targetCategory = 'street';
    } else if (text.includes('faixa')) {
      targetCategory = 'crosswalk';
      targetEntityId = 'crosswalk-north';
    }

    if (isAvoid) {
      directiveType = 'avoid_place';
      description = `Evitar ${targetCategory || 'o local indicado'}`;
      actionRequired = 'reroute';

      // Aplica penalidade hedônica máxima no mapa de preferências
      if (targetEntityId) {
        this.memory.placePreferences[targetEntityId] = -1.0;
      }
      if (targetCategory === 'cafe') {
        this.memory.placePreferences['cafe-bistro'] = -1.0;
        this.memory.placePreferences['cafe-table-outdoor'] = -1.0;
      } else if (targetCategory === 'market') {
        this.memory.placePreferences['market-central'] = -1.0;
      } else if (targetCategory === 'praca') {
        this.memory.placePreferences['bench-praca-west'] = -1.0;
        this.memory.placePreferences['bench-praca-east'] = -1.0;
        this.memory.placePreferences['bench-praca-north'] = -1.0;
        this.memory.placePreferences['bench-praca-south'] = -1.0;
        this.memory.placePreferences['fountain-monumental'] = -1.0;
      }

      // Se a intenção atual era ir para este local, cancela imediatamente
      if (this.currentIntention) {
        const intentTarget = this.currentIntention.candidate.targetId.toLowerCase();
        if (targetEntityId && intentTarget.includes(targetEntityId)) {
          this.currentIntention = null;
          this.currentActivity = null;
        } else if (targetCategory && intentTarget.includes(targetCategory)) {
          this.currentIntention = null;
          this.currentActivity = null;
        }
      }

      confirmationSpeech = `Entendido e gravado, Daniel! Aprendi que devo evitar ${targetCategory ? 'o(a) ' + targetCategory : 'esse local'}. Rota cancelada e memorizada permanentemente!`;
    } else if (isCrosswalk) {
      directiveType = 'use_crosswalk';
      targetCategory = 'crosswalk';
      targetEntityId = 'crosswalk-north';
      description = 'Atravessar exclusivamente pela faixa de pedestres respeitando o semáforo';
      actionRequired = 'crosswalk';

      // Reforça preferência máxima pelas faixas
      this.memory.placePreferences['crosswalk-north'] = 1.0;
      this.memory.placePreferences['crosswalk-south'] = 1.0;
      this.memory.suggestedTargets['crosswalk-north'] = 1.0;

      confirmationSpeech = 'Instrução gravada com sucesso, Daniel! Aprendi que devo sempre utilizar a faixa de pedestres. Estou indo para a faixa e jamais esquecerei!';
    } else if (isGoTo && targetCategory) {
      directiveType = 'go_to_place';
      description = `Dirigir-se ao local: ${targetCategory}`;
      actionRequired = 'goto';

      if (targetEntityId) {
        this.memory.suggestedTargets[targetEntityId] = 1.0;
        this.memory.placePreferences[targetEntityId] = 0.9;
      }

      confirmationSpeech = `Instrução assimilada, Daniel! Roteando imediatamente em direção a ${targetCategory} conforme sua orientação.`;
    } else if (isStop) {
      directiveType = 'wait_stop';
      description = 'Parar e aguardar com segurança';
      actionRequired = 'stop';
      this.currentIntention = null;
      this.currentActivity = null;

      confirmationSpeech = 'Compreendido, Daniel! Parando no local e mantendo postura segura na calçada.';
    } else {
      directiveType = 'custom_rule';
      description = `Instrução cívica: "${playerMessage}"`;
      confirmationSpeech = `Instrução ouvida e gravada, Daniel: "${playerMessage}". Guardei esta diretiva na minha memória permanente e não a esquecerei!`;
      if (targetEntityId && !isAvoid) {
        this.memory.suggestedTargets[targetEntityId] = 0.85;
      }
    }

    const directive: LearnedDirective = {
      id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      instruction: playerMessage,
      directiveType,
      targetEntityId,
      targetCategory,
      strength: 1.0,
      learnedAt: Date.now(),
      active: true,
      description,
    };

    // Atualiza ou insere diretiva
    const existingIdx = this.memory.learnedDirectives.findIndex(
      (d) => d.directiveType === directiveType && d.targetCategory === targetCategory,
    );
    if (existingIdx >= 0) {
      this.memory.learnedDirectives[existingIdx] = directive;
    } else {
      this.memory.learnedDirectives.push(directive);
    }

    return { directive, confirmationSpeech, actionRequired };
  }

  /**
   * Processa interação recebida do avatar Daniel (A8):
   * Constrói memória afetiva, satisfaz carência social e extrai possíveis
   * estímulos de locais sugeridos na mensagem de Daniel (ex: "vai ao café").
   */
  public receivePlayerInteraction(playerMessage: string): { suggestedEntityId?: string } {
    const { directive } = this.learnAvatarInstruction(playerMessage);
    return { suggestedEntityId: directive.targetEntityId };
  }

  public static readonly SOCIAL_TRANSMISSION_FACTOR = SOCIAL_TRANSMISSION_FACTOR;

  /**
   * Recebe uma preferência/viés transmitido socialmente por outro habitante (Task-039).
   */
  public receiveSocialPreference(placeId: string, transmittedValue: number): void {
    this.memory.placePreferences = this.memory.placePreferences || {};
    const curr = this.memory.placePreferences[placeId];
    if (curr === undefined || Math.abs(curr) < 0.01) {
      this.memory.placePreferences[placeId] = Math.max(-1, Math.min(1, transmittedValue));
    } else {
      // Integra o viés cultural ao histórico pessoal existente
      this.memory.placePreferences[placeId] = Math.max(-1, Math.min(1, curr * 0.6 + transmittedValue * 0.4));
    }
  }

  /**
   * Transmite preferências hedônicas entre habitantes durante interação social (Task-039).
   * Aplica o fator de decaimento geracional de 0.85 por salto (Dossiê Técnico P6).
   */
  public transmitSocialPreferences(
    peer: AgentMind,
    factor: number = SOCIAL_TRANSMISSION_FACTOR,
  ): {
    transmittedFromSelf: Record<string, number>;
    transmittedFromPeer: Record<string, number>;
  } {
    const transmittedFromSelf: Record<string, number> = {};
    const transmittedFromPeer: Record<string, number> = {};

    // Snapshot prévio de ambos para evitar que o agente ecoe de volta o que acabou de ouvir
    const selfPrefs = { ...(this.memory.placePreferences ?? {}) };
    const peerPrefs = { ...(peer.memory.placePreferences ?? {}) };

    // Transmissão Self -> Peer
    for (const [placeId, val] of Object.entries(selfPrefs)) {
      if (Math.abs(val) >= 0.05) {
        const discounted = Math.max(-1, Math.min(1, val * factor));
        peer.receiveSocialPreference(placeId, discounted);
        transmittedFromSelf[placeId] = discounted;
      }
    }

    // Transmissão Peer -> Self
    for (const [placeId, val] of Object.entries(peerPrefs)) {
      if (Math.abs(val) >= 0.05) {
        const discounted = Math.max(-1, Math.min(1, val * factor));
        this.receiveSocialPreference(placeId, discounted);
        transmittedFromPeer[placeId] = discounted;
      }
    }

    return { transmittedFromSelf, transmittedFromPeer };
  }

  /**
   * Arrefece preferências hedônicas ao longo do tempo (Task-039).
   * Evita aversão ou fixação perpétua em locais da cidade.
   */
  public coolDownPreferences(decayFactor: number = 0.98): void {
    if (!this.memory.placePreferences) return;
    for (const placeId of Object.keys(this.memory.placePreferences)) {
      const curr = this.memory.placePreferences[placeId];
      if (curr !== undefined) {
        const cooled = curr * decayFactor;
        if (Math.abs(cooled) < 0.02) {
          delete this.memory.placePreferences[placeId];
        } else {
          this.memory.placePreferences[placeId] = cooled;
        }
      }
    }
  }

  /**
   * Consolida experiências prévias (PostgreSQL/Qdrant) em preferências hedônicas de locais (Task-039).
   * Aplica decaimento temporal para experiências passadas e modula a utilidade de visitação.
   */
  public integrateExperiences(experiences: ExperienceInput[], now: number = Date.now()): void {
    if (!experiences || experiences.length === 0) return;

    this.memory.placePreferences = this.memory.placePreferences || {};

    for (const exp of experiences) {
      let targetId: string | undefined = exp.locationId || undefined;

      if (!targetId && exp.relatedEntityIds && exp.relatedEntityIds.length > 0) {
        targetId = exp.relatedEntityIds[0];
      }

      const text = `${exp.eventType ?? ''} ${exp.description ?? ''} ${exp.content ?? ''}`.toLowerCase();

      if (!targetId) {
        if (text.includes('market-central') || text.includes('mercado') || text.includes('supermercado')) {
          targetId = 'market-central';
        } else if (text.includes('cafe-bistro') || text.includes('café') || text.includes('bistro')) {
          targetId = 'cafe-bistro';
        } else if (text.includes('fountain') || text.includes('fonte')) {
          targetId = 'fountain-monumental';
        } else if (text.includes('crosswalk-central') || text.includes('faixa') || text.includes('cruzamento') || text.includes('crosswalk')) {
          targetId = 'crosswalk-north';
        } else if (text.includes('bus-stop') || text.includes('ônibus') || text.includes('parada')) {
          targetId = 'bus-stop-west';
        } else if (text.includes('bench') || text.includes('banco')) {
          targetId = 'bench-praca-west';
        }
      }

      if (!targetId) continue;

      // Determina a valência da experiência
      let baseValence: number;
      const meta =
        typeof exp.metadata === 'object' && exp.metadata !== null
          ? (exp.metadata as Record<string, unknown>)
          : undefined;

      if (meta && typeof meta['valence'] === 'number') {
        baseValence = meta['valence'] as number;
      } else if (
        meta?.['hazard'] === true ||
        meta?.['success'] === false ||
        /ruim|péssim|perigo|desconfort|lotad|suj|barulh|atropel|acident|intoxica|estragad|caro|hazard|danger|bad|negative|threat|warning|hostil/i.test(text)
      ) {
        baseValence = -0.85;
      } else if (
        meta?.['success'] === true ||
        /bom|ótimo|excelent|segur|saboros|refeição|tranquil|agradável|confort|success|safe|delicious|tasty|positive/i.test(text)
      ) {
        baseValence = 0.70;
      } else {
        baseValence = 0.15;
      }

      const importance = typeof exp.emotionalWeight === 'number'
        ? exp.emotionalWeight
        : (Number(exp.importance) || 0.6);
      const confidence = Number(exp.confidence) || 1.0;

      // Decaimento temporal da experiência passada (0.97 por hora transcorrida)
      const rawTime = exp.occurredAt ?? exp.timestamp;
      const expTime = rawTime ? new Date(rawTime).getTime() : now;
      const elapsedHours = Math.max(0, (now - expTime) / 3_600_000);
      const timeDecay = Math.pow(0.97, elapsedHours);

      const impact = baseValence * importance * confidence * timeDecay;

      const curr = this.memory.placePreferences[targetId] ?? 0;
      const newVal = curr === 0 ? impact : (curr * 0.8 + impact * 0.4);
      this.memory.placePreferences[targetId] = Math.max(-1, Math.min(1, newVal));

      if (targetId === 'crosswalk-central-01') {
        this.memory.placePreferences['crosswalk-north'] = Math.max(-1, Math.min(1, newVal));
      }
    }
  }

  /**
   * Executa interação social direta e espontânea entre dois agentes autônomos (A9):
   * Ambos atualizam afinidade mútua, restauram convívio, trocam saudação e
   * transmitem preferências hedônicas culturais com fator 0.85 (Task-039).
   */
  public interactWithAgentPeer(peer: AgentMind): {
    greetingFromSelf: string;
    replyFromPeer: string;
    transmittedPreferences: {
      transmittedFromSelf: Record<string, number>;
      transmittedFromPeer: Record<string, number>;
    };
  } {
    this.recordSocialInteraction(peer.id, true);
    peer.recordSocialInteraction(this.id, true);

    const transmittedPreferences = this.transmitSocialPreferences(peer);

    const greetingFromSelf = `Olá ${peer.name}! Tudo bem contigo?`;
    const replyFromPeer = `Oi ${this.name}! Tudo tranquilo por aqui na praça.`;

    return { greetingFromSelf, replyFromPeer, transmittedPreferences };
  }
}
