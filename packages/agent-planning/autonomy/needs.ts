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
  shelter: { energy: 0.15, fun: 0.1, curiosity: 0.05 },
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
  shelter: 2,
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

/** Contexto ambiental global para modulação fisiológica e cognitiva (Task-040). */
export interface EnvironmentalContext {
  weather?: 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  timeOfDay?: number; // 0..24
  isSheltered?: boolean;
}

/** Determina se a hora do dia corresponde ao período noturno (Task-040). */
export function isNightTime(timeOfDay?: number): boolean {
  if (timeOfDay === undefined) return false;
  return timeOfDay >= 20 || timeOfDay < 6;
}

/**
 * Peso subjetivo de cada necessidade segundo a personalidade e o ambiente global.
 * Extrovertidos sentem mais falta de companhia; abertos à experiência, de novidade;
 * De noite, a biologia humana exige repouso (energia); sob chuva, diversão decai (Task-040).
 */
export function needWeights(p: Personality, env?: EnvironmentalContext): Needs {
  const isNight = isNightTime(env?.timeOfDay);
  const isRaining = env?.weather === 'rain' || env?.weather === 'storm';

  // À noite, o corpo e a mente demandam sono/descanso com prioridade urgente
  const energyMultiplier = isNight ? 2.5 : 1.0;
  // Chuva e intempéries ao ar livre drenam a paciência e elevam a urgência de conforto/diversão
  const funMultiplier = isRaining && !env?.isSheltered ? 1.6 : 1.0;

  return {
    energy: (0.8 + p.neuroticism * 0.4) * energyMultiplier,
    hunger: 1.0,
    social: 0.5 + p.extraversion,
    curiosity: 0.5 + p.openness,
    fun: (0.6 + (1 - p.conscientiousness) * 0.8) * funMultiplier,
  };
}

export function decayNeeds(
  needs: Needs,
  p: Personality,
  dtSeconds: number,
  env?: EnvironmentalContext,
): Needs {
  const w = needWeights(p, env);
  const minutes = Math.max(0, dtSeconds) / 60;
  const next = { ...needs };

  const isNight = isNightTime(env?.timeOfDay);
  const isRaining = env?.weather === 'rain' || env?.weather === 'storm';

  for (const k of NEED_KEYS) {
    let envDecayMult = 1.0;
    // Noite acelera o gasto de energia (sono acumulando)
    if (k === 'energy' && isNight) envDecayMult = 1.8;
    // Chuva sem abrigo drena diversão mais rápido (-fun) e aumenta desgaste físico
    if (k === 'fun' && isRaining && !env?.isSheltered) envDecayMult = 2.2;
    if (k === 'energy' && isRaining && !env?.isSheltered) envDecayMult = 1.3;

    next[k] = clamp01(needs[k] - BASE_DECAY_PER_MINUTE[k] * w[k] * envDecayMult * minutes);
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
export function wellbeing(needs: Needs, p: Personality, env?: EnvironmentalContext): number {
  const w = needWeights(p, env);
  let sum = 0;
  let wsum = 0;
  for (const k of NEED_KEYS) {
    sum += needs[k] * w[k];
    wsum += w[k];
  }
  return wsum > 0 ? sum / wsum : 0;
}

export function mostPressingNeed(
  needs: Needs,
  p: Personality,
  env?: EnvironmentalContext,
): NeedKey {
  const w = needWeights(p, env);
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
