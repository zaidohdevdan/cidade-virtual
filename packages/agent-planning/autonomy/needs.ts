// packages/agent-planning/autonomy/needs.ts
// Dinâmica das necessidades internas e efeitos das affordances do mundo.

import { NEED_KEYS, type AffordanceType, type NeedKey, type Needs, type Personality } from './types.js';

/** Efeito de usar cada affordance sobre as necessidades (por uso completo). Física do mundo, igual para todos. */
export const AFFORDANCE_EFFECTS: Record<AffordanceType, Partial<Needs>> = {
  rest: { energy: 0.4, fun: 0.02 },
  eat: { hunger: 0.6, energy: 0.1, social: 0.05 },
  socialize: { social: 0.5, fun: 0.12 },
  observe: { curiosity: 0.3, fun: 0.04 },
  contemplate: { curiosity: 0.15, fun: 0.12, energy: 0.1 },
  shop: { hunger: 0.4, curiosity: 0.1 },
  explore: { curiosity: 0.35, fun: 0.15, energy: -0.08 },
};

/** Quantos ticks a atividade dura depois que o agente chega ao alvo. */
export const AFFORDANCE_DURATION_TICKS: Record<AffordanceType, number> = {
  rest: 3,
  eat: 3,
  socialize: 2,
  observe: 1,
  contemplate: 2,
  shop: 2,
  explore: 1,
};

/** Taxa base de decaimento por minuto. */
const BASE_DECAY_PER_MINUTE: Needs = {
  energy: 0.02,
  hunger: 0.025,
  social: 0.03,
  curiosity: 0.03,
  fun: 0.025,
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Peso subjetivo de cada necessidade segundo a personalidade.
 * Extrovertidos sentem mais falta de companhia; abertos à experiência, de novidade; etc.
 */
export function needWeights(p: Personality): Needs {
  return {
    energy: 0.8 + p.neuroticism * 0.4,
    hunger: 1.0,
    social: 0.5 + p.extraversion,
    curiosity: 0.5 + p.openness,
    fun: 0.6 + (1 - p.conscientiousness) * 0.8,
  };
}

export function decayNeeds(needs: Needs, p: Personality, dtSeconds: number): Needs {
  const w = needWeights(p);
  const minutes = Math.max(0, dtSeconds) / 60;
  const next = { ...needs };
  for (const k of NEED_KEYS) {
    next[k] = clamp01(needs[k] - BASE_DECAY_PER_MINUTE[k] * w[k] * minutes);
  }
  return next;
}

export function applyEffect(needs: Needs, effect: Partial<Needs>, fraction = 1): Needs {
  const next = { ...needs };
  for (const k of NEED_KEYS) {
    const delta = effect[k];
    if (delta !== undefined) next[k] = clamp01(needs[k] + delta * fraction);
  }
  return next;
}

/** Bem-estar ponderado (0..1): quanto mais alto, mais satisfeito o agente está. */
export function wellbeing(needs: Needs, p: Personality): number {
  const w = needWeights(p);
  let sum = 0;
  let wsum = 0;
  for (const k of NEED_KEYS) {
    sum += needs[k] * w[k];
    wsum += w[k];
  }
  return wsum > 0 ? sum / wsum : 0;
}

export function mostPressingNeed(needs: Needs, p: Personality): NeedKey {
  const w = needWeights(p);
  let best: NeedKey = 'energy';
  let bestScore = -Infinity;
  for (const k of NEED_KEYS) {
    const score = (1 - needs[k]) * w[k];
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return best;
}

export function createInitialNeeds(rng: () => number): Needs {
  const n = {} as Needs;
  for (const k of NEED_KEYS) n[k] = 0.5 + rng() * 0.4;
  return n;
}

const NEED_LABELS_PT: Record<NeedKey, string> = {
  energy: 'energia',
  hunger: 'saciedade',
  social: 'convívio',
  curiosity: 'curiosidade satisfeita',
  fun: 'diversão',
};

export const NEED_MOTIVE_PT: Record<NeedKey, string> = {
  energy: 'sinto cansaço',
  hunger: 'sinto fome',
  social: 'sinto falta de companhia',
  curiosity: 'quero descobrir algo novo',
  fun: 'quero me distrair um pouco',
};

export function describeNeedsPt(needs: Needs): string {
  return NEED_KEYS.map((k) => `${NEED_LABELS_PT[k]} ${Math.round(needs[k] * 100)}%`).join(', ');
}
