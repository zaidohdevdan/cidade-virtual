// packages/agent-planning/autonomy/utility-decider.ts
// Decisor por utilidade: avalia todas as affordances visíveis/conhecidas e pontua
// cada opção segundo necessidades internas, traços de personalidade, distância física,
// novidade (anti-repetição) e memória de interações.

import {
  type ActionCandidate,
  type AffordanceType,
  type Needs,
  type Percept,
  type Personality,
  type Vec3,
  NEED_KEYS,
} from './types.js';
import { AFFORDANCE_EFFECTS, needWeights } from './needs.js';

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
}

export interface DeciderOptions {
  now?: number;
  maxDistance?: number;
  explorationNoise?: number;
  rng?: () => number;
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
      score: 0,
    });
  }

  return candidates;
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
  const weights = needWeights(p);
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
    // Preferência aprendida por experiência prévia em entidades físicas (A10)
    const learnedPref = memory.placePreferences?.[cand.targetId] ?? 0;
    preference += learnedPref * 0.35;
  }

  // Estímulo / sugestão direta recente do jogador Daniel (A8)
  const suggestionBonus = memory.suggestedTargets?.[cand.targetId] ?? 0;
  preference += suggestionBonus * 0.65;

  // 5. Salência do estímulo (proximidade imediata):
  const salience = cand.distance < 4.0 ? 0.08 : 0;

  // 6. Ruído de exploração (aleatoriedade natural):
  const noiseScale = opts.explorationNoise ?? 0.08 * (0.5 + p.openness * 0.5);
  const noise = (rng() - 0.5) * noiseScale;

  // Pontuação final agregada
  const score = needGain - distanceCost + preference + novelty + salience + noise;

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
