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
export type AffordanceType = 'rest' | 'eat' | 'socialize' | 'observe' | 'contemplate' | 'shop' | 'explore' | 'shelter';

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
  /** Indica se a entidade possui cobertura/teto físico que serve como abrigo contra chuva ou sol intenso (Task-040). */
  hasCover?: boolean;
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

export interface PerceivedVehicle {
  id: string;
  position: Vec3;
  distance: number;
  speed?: number;
}

export type TrafficLight = 'green' | 'yellow' | 'red';
export type WorldWeather = 'clear' | 'rain' | 'storm' | 'fog' | 'snow';

export interface Percept {
  position: Vec3;
  entities: PerceivedEntity[];
  actors: PerceivedActor[];
  trafficLight: TrafficLight;
  /** Condição climática do mundo afetando a cognição física (Task-040). */
  weather?: WorldWeather;
  /** Hora do dia no relógio da simulação (0..24), determinando dia/noite (Task-040). */
  timeOfDay?: number;
  /** Densidade média de tráfego percebida no entorno imediato (0..1) (Task-040). */
  trafficDensity?: number;
  /** Veículos percebidos no raio físico de atenção (Task-040). */
  vehicles?: PerceivedVehicle[];
}

export type CandidateTargetKind = 'entity' | 'agent' | 'player' | 'place';

export interface ScoreBreakdown {
  needGain: number;
  distanceCost: number;
  preference: number;
  novelty: number;
  salience: number;
  noise: number;
  /** Modificador ambiental global da física do mundo: clima, hora do dia e segurança de tráfego (Task-040). */
  environmentalModifier?: number;
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
  /** Indica se o alvo oferece abrigo/cobertura climática (Task-040). */
  hasCover?: boolean;
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
