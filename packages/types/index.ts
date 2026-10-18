// packages/types/index.ts
// SYNAPSE CITY ENGINE — Contratos e Tipos Fundamentais (Versão 2.0.0)

export type CitizenId = string & { readonly __brand: 'CitizenId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type TicketId = string & { readonly __brand: 'TicketId' };

export interface GeoCoords {
  lat: number;
  lng: number;
  altitude?: number;
}

export type CitizenArchetype = 'worker' | 'guard' | 'citizen' | 'child' | 'elder';

export type EmotionState =
  | 'calm'
  | 'fearful'
  | 'curious'
  | 'angry'
  | 'joyful'
  | 'melancholic'
  | 'confused';

// ── Tipos de Memória Funcional (SKILL 2.0.0 Seção 3.6) ──
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'social' | 'collective';

export interface MemorySnippet {
  id: string;
  citizenId: CitizenId;
  content: string; // texto natural da memória
  embedding: number[]; // vetor
  timestamp: Date;
  sensoryTags: ('visual' | 'auditory' | 'social' | 'internal')[];
  emotionalWeight: number; // 0..1 — quanto maior, mais central na identidade
  origin: 'observation' | 'interaction' | 'event' | 'reflection';
  memoryType?: MemoryType;
  sourceType?: 'direct_observation' | 'action_result' | 'agent_report' | 'environment' | 'inference';
  confidence?: number;
}

// ── Contrato de Ação Validável (SKILL 2.0.0 Seção 3.4) ──
export interface AgentAction {
  agentId: string;
  actionType: string;
  targetId?: string;
  parameters: Record<string, unknown>;
  reasonCode?: string;
  expectedOutcome?: string;
}

// ── Contrato de Experiência do Habitante (SKILL 2.0.0 Seção 5) ──
export interface AgentExperience {
  id: string;
  agentId: string;
  eventType: string;
  description: string;
  occurredAt: string;
  locationId?: string;
  sourceType:
    | 'direct_observation'
    | 'action_result'
    | 'agent_report'
    | 'environment'
    | 'inference';
  sourceAgentId?: string;
  confidence?: number;
  importance?: number;
  relatedEntityIds: string[];
  metadata?: Record<string, unknown>;
}

// ── Contrato de Conhecimento Estruturado (SKILL 2.0.0 Seção 3.9) ──
export interface KnowledgeItem {
  id: string;
  content: string;
  sourceType: 'observation' | 'social_transmission' | 'consensus' | 'hypothesis';
  originAgentId?: string;
  acquiredAt: string;
  confidence: number;
  verified: boolean;
  historicalUpdates: Array<{ timestamp: string; note: string }>;
}

// ── Eventos de Domínio do Mundo e Agentes (SKILL 2.0.0 Seção 8) ──
export type DomainEventName =
  | 'world.object.discovered'
  | 'world.object.changed'
  | 'agent.observation.created'
  | 'agent.action.requested'
  | 'agent.action.executed'
  | 'agent.action.failed'
  | 'agent.experience.recorded'
  | 'agent.memory.consolidation.requested'
  | 'agent.memory.consolidated'
  | 'agent.knowledge.proposed'
  | 'agent.knowledge.shared'
  | 'agent.knowledge.verified'
  | 'agent.strategy.updated';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  name: DomainEventName | string;
  timestamp: string;
  origin: string;
  payload: T;
}

export interface EventLog {
  id: EventId;
  type: 'accident' | 'festival' | 'crime' | 'weather' | 'civic';
  location: GeoCoords;
  timestamp: Date;
  affectedCitizens: CitizenId[];
  description: string;
}

export interface DiffPatch {
  filePath: string;
  before: string;
  after: string;
  rationale: string;
}

export interface SceneSnapshot {
  scenarioId: string;
  citizens: Array<{ id: CitizenId; position: GeoCoords; emotion: EmotionState }>;
  objects: Array<{ id: string; type: string; position: GeoCoords }>;
  weather: 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  timeOfDay: number; // 0..23
}

// ── Contratos Socket.IO em Tempo Real (Task-021) ──
export type TrafficLightSignal = 'green' | 'yellow' | 'red';

export interface WorldStateEventPayload {
  scenarioId: string;
  name?: string;
  tickCount: number;
  timeOfDay: number;
  weather: 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  trafficLight: TrafficLightSignal;
  updatedAt?: string;
}

export interface AvatarPositionPayload {
  clientId: string;
  x: number;
  y: number;
  z: number;
  rotationY?: number;
}
