// packages/agent-planning/autonomy/types.ts
// Tipos do núcleo de autonomia emergente: o mundo expõe affordances (o que é possível fazer),
// o agente decide o que quer fazer a partir de necessidades internas, personalidade e memória.
// Nenhum destino, tarefa ou rota é pré-definido por agente.

export interface Vec3 {
  x: number;
  y?: number;
  z: number;
}

/** Necessidades internas. 0 = carência total, 1 = plenamente satisfeita. */
export const NEED_KEYS = ['energy', 'hunger', 'social', 'curiosity', 'fun'] as const;
export type NeedKey = (typeof NEED_KEYS)[number];
export type Needs = Record<NeedKey, number>;

/** Traços de personalidade (Big Five), 0..1. Moldam quais necessidades pesam mais e a variabilidade das escolhas. */
export interface Personality {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

/** O que uma entidade do mundo permite fazer. É física do mundo, não tarefa de um agente. */
export type AffordanceType = 'rest' | 'eat' | 'socialize' | 'observe' | 'contemplate' | 'shop' | 'explore';

export interface WorldEntity {
  id: string;
  label: string;
  kind: string;
  position: Vec3;
  /** Ponto caminhável para usar a entidade (ex.: frente do prédio). */
  approach?: Vec3;
  affordances: AffordanceType[];
  /** Multiplicador da qualidade da experiência (ex.: fonte monumental contempla melhor que uma placa). */
  quality?: number;
}

export interface PerceivedEntity {
  entity: WorldEntity;
  distance: number;
}

export interface ActorSnapshot {
  id: string;
  name: string;
  kind: 'agent' | 'player';
  position: Vec3;
  activity?: string;
}

export interface PerceivedActor extends ActorSnapshot {
  distance: number;
}

export type TrafficLight = 'green' | 'yellow' | 'red';

export interface Percept {
  position: Vec3;
  entities: PerceivedEntity[];
  actors: PerceivedActor[];
  trafficLight: TrafficLight;
}

export type CandidateTargetKind = 'entity' | 'agent' | 'player' | 'place';

export interface ScoreBreakdown {
  needGain: number;
  distanceCost: number;
  preference: number;
  novelty: number;
  salience: number;
  noise: number;
}

export interface ActionCandidate {
  /** Identificador estável da opção (affordance:alvo). */
  id: string;
  affordance: AffordanceType;
  targetId: string;
  targetLabel: string;
  targetKind: CandidateTargetKind;
  destination: Vec3;
  distance: number;
  quality: number;
  score: number;
  breakdown?: ScoreBreakdown;
}

export type DecisionSource = 'utility' | 'llm';

export interface Intention {
  candidate: ActionCandidate;
  reason: string;
  source: DecisionSource;
  decidedAt: number;
  speech?: string;
}

export interface ActivityState {
  candidate: ActionCandidate;
  remainingTicks: number;
  totalTicks: number;
  wellbeingBefore: number;
}
