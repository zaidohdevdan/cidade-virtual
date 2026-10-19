// packages/agent-planning/autonomy/utility-decider.ts
// Decisor por utilidade: avalia todas as affordances visíveis/conhecidas e pontua
// cada opção segundo necessidades internas, traços de personalidade, distância física,
// novidade (anti-repetição) e memória de interações.

import {
  type ActionCandidate,
  type AffordanceType,
  type LearnedDirective,
  type Needs,
  type Percept,
  type Personality,
  type Vec3,
  NEED_KEYS,
} from './types.js';
import { AFFORDANCE_EFFECTS, needWeights, type EnvironmentalContext } from './needs.js';
import { isCoveredEntity } from './world-affordances.js';

export interface MemoryContext {
  /** Timestamp do último uso de cada affordance:alvo. */
  lastVisitedAt?: Record<string, number>;
  /** Contagem de visitas recentes por ID de entidade/ator. */
  visitCounts?: Record<string, number>;
  /** Nível de afeição/afinidade com atores (0..1). */
  actorAffinity?: Record<string, number>;
  /** Preferências subjetivas aprendidas para entidades físicas (-1..1). */
  placePreferences?: Record<string, number>;
  /** Estímulos ou sugestões recebidas do avatar Daniel ou de outros agentes (0..1). */
  suggestedTargets?: Record<string, number>;
  /** Diretivas e instruções permanentes aprendidas do avatar Daniel */
  learnedDirectives?: LearnedDirective[];
}

export interface DeciderOptions {
  now?: number;
  maxDistance?: number;
  explorationNoise?: number;
  rng?: () => number;
  forceLLM?: boolean;
  /** Percepção ambiental física do mundo (clima, hora, tráfego) (Task-040). */
  percept?: Percept;
}

export function distance2D(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Gera candidatos de ação a partir do que o agente percebe no mundo e ao seu redor.
 */
export function generateCandidates(
  agentPos: Vec3,
  percept: Percept,
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];

  // 1. Candidatos a partir de entidades físicas do mundo
  for (const item of percept.entities) {
    const e = item.entity;
    const dest = e.approach ?? e.position;
    const dist = distance2D(agentPos, dest);
    const hasCover = isCoveredEntity(e);

    for (const affordance of e.affordances) {
      candidates.push({
        id: `${affordance}:${e.id}`,
        affordance,
        targetId: e.id,
        targetLabel: e.label,
        targetKind: 'entity',
        destination: dest,
        distance: dist,
        quality: e.quality ?? 1.0,
        hasCover,
        score: 0,
      });
    }
  }

  // 2. Candidatos a partir de atores presentes (outros agentes e o avatar Daniel)
  for (const actor of percept.actors) {
    const dist = distance2D(agentPos, actor.position);
    const isPlayer = actor.kind === 'player';

    candidates.push({
      id: `socialize:${actor.id}`,
      affordance: 'socialize',
      targetId: actor.id,
      targetLabel: actor.name,
      targetKind: isPlayer ? 'player' : 'agent',
      destination: actor.position,
      distance: dist,
      quality: isPlayer ? 1.4 : 1.1,
      hasCover: false,
      score: 0,
    });

    candidates.push({
      id: `observe:${actor.id}`,
      affordance: 'observe',
      targetId: actor.id,
      targetLabel: actor.name,
      targetKind: isPlayer ? 'player' : 'agent',
      destination: actor.position,
      distance: dist,
      quality: 0.9,
      hasCover: false,
      score: 0,
    });
  }

  return candidates;
}

/**
 * Modificadores ambientais globais baseados na física do mundo (Task-040).
 * NUNCA depende da identidade, nome ou arquétipo do agente (regra universal da física da cidade).
 */
export function calculateEnvironmentalModifier(
  cand: ActionCandidate,
  percept?: Percept,
): number {
  if (!percept) return 0;

  let modifier = 0;
  const weather = percept.weather ?? 'clear';
  const timeOfDay = percept.timeOfDay;
  const trafficDensity = percept.trafficDensity ?? 0;
  const vehicles = percept.vehicles ?? [];

  // 1. Clima: Chuva e tempestade incentivam busca por abrigo e penalizam exposição a céu aberto
  if (weather === 'rain' || weather === 'storm') {
    const severity = weather === 'storm' ? 1.5 : 1.0;
    if (cand.hasCover || cand.affordance === 'shelter') {
      modifier += 0.55 * severity;
    } else {
      modifier -= 0.60 * severity;
    }
  }

  // 2. Hora do dia: À noite, descanso é favorecido e exploração/compras arrefecem
  if (timeOfDay !== undefined) {
    const isNight = timeOfDay >= 20 || timeOfDay < 6;
    if (isNight) {
      if (cand.affordance === 'rest') {
        modifier += 0.45;
      } else if (cand.affordance === 'explore') {
        modifier -= 0.35;
      } else if (cand.affordance === 'shop') {
        modifier -= 0.30;
      }
    }
  }

  // 3. Segurança e Tráfego: Veículos próximos e alta densidade viária penalizam travessias/atividades na via
  if (vehicles.length > 0) {
    let minDistToVehicle = Infinity;
    for (const v of vehicles) {
      const dist = distance2D(cand.destination, v.position);
      if (dist < minDistToVehicle) minDistToVehicle = dist;
    }
    if (minDistToVehicle < 6.0) {
      // Penalidade de segurança proporcional à proximidade imediata de veículos
      modifier -= 0.40 * (1 - minDistToVehicle / 6.0);
    }
  }

  if (trafficDensity > 0.4) {
    // Se o alvo for travessia ou área da pista (ex.: crosswalk ou |X| <= 6), penaliza pela intensidade do fluxo
    const isNearStreet = Math.abs(cand.destination.x) <= 6.5;
    if (isNearStreet || cand.targetId.includes('crosswalk')) {
      modifier -= 0.35 * trafficDensity;
    }
  }

  return modifier;
}

/**
 * Pontua um candidato de ação com base em utilidade esperada.
 */
export function scoreCandidate(
  cand: ActionCandidate,
  needs: Needs,
  p: Personality,
  memory: MemoryContext,
  opts: DeciderOptions = {},
): ActionCandidate {
  const now = opts.now ?? Date.now();
  const rng = opts.rng ?? Math.random;
  const percept = opts.percept;
  const env: EnvironmentalContext = {
    weather: percept?.weather,
    timeOfDay: percept?.timeOfDay,
    isSheltered: cand.hasCover,
  };
  const weights = needWeights(p, env);
  const effect = AFFORDANCE_EFFECTS[cand.affordance] ?? {};

  // 1. Ganho de satisfação das necessidades: quanto mais carente estiver o agente,
  // maior a utilidade marginal da affordance. Déficits severos (> 0.5) possuem urgência exponencial.
  let needGain = 0;
  for (const k of NEED_KEYS) {
    const delta = effect[k];
    if (delta !== undefined && delta > 0) {
      const deficit = 1 - needs[k]; // 0 (satisfeito) a 1 (faminto/exausto)
      const urgency = deficit > 0.5 ? Math.pow(deficit * 1.5, 1.6) : deficit;
      needGain += urgency * delta * weights[k];
    }
  }
  // Multiplica pela qualidade intrínseca do alvo
  needGain *= cand.quality;

  // 2. Custo da distância física: esforço de locomoção atenuado
  // para que distâncias normais da cidade (20 a 60m) permitam o agente cruzar a rua
  // quando estiver com necessidades reais
  const distanceFactor = 0.012 * (1 + (1 - needs.energy) * 0.5);
  const distanceCost = Math.min(1.2, cand.distance * distanceFactor);

  // 3. Novidade e anti-repetição (fadiga de repetição):
  // Visitar o mesmo banco ou comer sem parar reduz o valor; alvos novos ganham bônus.
  const visits = memory.visitCounts?.[cand.targetId] ?? 0;
  const repetitionPenalty = Math.min(0.6, visits * 0.12);

  const lastVisit = memory.lastVisitedAt?.[cand.id];
  let noveltyBonus = 0;
  if (!lastVisit) {
    noveltyBonus = 0.15 * p.openness;
  } else {
    const elapsedMinutes = (now - lastVisit) / 60000;
    if (elapsedMinutes < 2) {
      noveltyBonus -= 0.3; // acabou de fazer isso
    } else {
      noveltyBonus += Math.min(0.2, (elapsedMinutes / 10) * 0.1);
    }
  }
  const novelty = noveltyBonus - repetitionPenalty;

  // 4. Preferência social / afinidade e preferências aprendidas de locais (A10)
  let preference = 0;
  if (cand.targetKind === 'player') {
    // Interação com o jogador avatar: modulada pela afinidade construída
    const playerAffinity = memory.actorAffinity?.[cand.targetId] ?? 0.6;
    preference += playerAffinity * (p.extraversion + p.openness) * 0.4;
  } else if (cand.targetKind === 'agent') {
    // Afinidade interpessoal com outros habitantes
    const affinity = memory.actorAffinity?.[cand.targetId] ?? 0.5;
    preference += (affinity - 0.5) * 0.5;
  } else {
    // Preferência aprendida por experiência prévia em entidades físicas (A10 / Task-039)
    let learnedPref = memory.placePreferences?.[cand.targetId] ?? 0;
    if (learnedPref === 0 && cand.targetId === 'crosswalk-north' && memory.placePreferences?.['crosswalk-central-01']) {
      learnedPref = memory.placePreferences['crosswalk-central-01'];
    }
    preference += learnedPref * 0.50;
  }

  // Estímulo / sugestão direta recente do jogador Daniel (A8)
  const suggestionBonus = memory.suggestedTargets?.[cand.targetId] ?? 0;
  preference += suggestionBonus * 0.65;

  // 4b. Diretivas explícitas e regras permanentes ensinadas pelo avatar Daniel
  if (memory.learnedDirectives && memory.learnedDirectives.length > 0) {
    for (const directive of memory.learnedDirectives) {
      if (!directive.active) continue;

      // Diretiva: EVITAR lugar (ex: "evitar café", "evitar praça", "não vá ao mercado")
      if (directive.directiveType === 'avoid_place') {
        const matchesTarget = directive.targetEntityId && cand.targetId === directive.targetEntityId;
        const matchesCategory = directive.targetCategory && (
          cand.targetId.toLowerCase().includes(directive.targetCategory.toLowerCase()) ||
          cand.targetLabel.toLowerCase().includes(directive.targetCategory.toLowerCase())
        );
        if (matchesTarget || matchesCategory) {
          // Penalidade decisiva: o agente NUNCA escolherá este local
          preference -= 999.0;
        }
      }

      // Diretiva: ATRAVESSAR PELA FAIXA (ex: "vc deve atravessar a faixa", "use a faixa de pedestre")
      else if (directive.directiveType === 'use_crosswalk') {
        const isCrosswalk = cand.targetId.includes('crosswalk') || cand.targetLabel.toLowerCase().includes('faixa');
        if (isCrosswalk) {
          preference += 15.0 * (directive.strength || 1.0);
        }
      }

      // Diretiva: IR PARA UM LUGAR ESPECÍFICO (ex: "vá ao mercado", "vá para a fonte")
      else if (directive.directiveType === 'go_to_place') {
        const matchesTarget = directive.targetEntityId && cand.targetId === directive.targetEntityId;
        const matchesCategory = directive.targetCategory && (
          cand.targetId.toLowerCase().includes(directive.targetCategory.toLowerCase()) ||
          cand.targetLabel.toLowerCase().includes(directive.targetCategory.toLowerCase())
        );
        if (matchesTarget || matchesCategory) {
          preference += 20.0 * (directive.strength || 1.0);
        }
      }
    }
  }

  // 5. Salência do estímulo (proximidade imediata):
  const salience = cand.distance < 4.0 ? 0.08 : 0;

  // 6. Ruído de exploração (aleatoriedade natural):
  const noiseScale = opts.explorationNoise ?? 0.08 * (0.5 + p.openness * 0.5);
  const noise = (rng() - 0.5) * noiseScale;

  // 7. Modificador ambiental global da física do mundo (Task-040)
  const environmentalModifier = calculateEnvironmentalModifier(cand, opts.percept);

  // Pontuação final agregada
  const score = needGain - distanceCost + preference + novelty + salience + noise + environmentalModifier;

  return {
    ...cand,
    score,
    breakdown: {
      needGain,
      distanceCost,
      preference,
      novelty,
      salience,
      noise,
      environmentalModifier,
    },
  };
}

/**
 * Ordena os candidatos do maior para o menor score de utilidade.
 */
export function rankCandidates(
  candidates: ActionCandidate[],
  needs: Needs,
  p: Personality,
  memory: MemoryContext,
  opts: DeciderOptions = {},
): ActionCandidate[] {
  return candidates
    .map((c) => scoreCandidate(c, needs, p, memory, opts))
    .sort((a, b) => b.score - a.score);
}
