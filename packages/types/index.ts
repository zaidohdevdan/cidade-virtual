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

// ── Contrato Canônico Principal + AgentAction API (Task-025) ──
export type PrincipalType = 'human' | 'npc' | 'system' | 'external_agent';
export type PrincipalRole = 'admin' | 'citizen' | 'guest' | 'moderator';

export interface Principal {
  id: string;
  type: PrincipalType;
  roles: PrincipalRole[];
  permissions: string[];
  agentId?: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionRequest {
  principal: Principal;
  actionType: string; // ex: 'move', 'observe', 'speak', 'interact', 'traffic_control'
  targetId?: string;
  parameters: Record<string, unknown>;
  reasonCode?: string;
  correlationId?: string;
  timestamp?: string;
}

export interface ActionResult {
  success: boolean;
  actionType: string;
  principalId: string;
  reasonCode?: string;
  outcome?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

/**
 * Mapeamento padrão de permissões por papel do Principal.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<PrincipalRole, string[]> = {
  admin: ['*'],
  citizen: ['action:move', 'action:observe', 'action:speak', 'action:interact'],
  guest: ['action:move', 'action:observe'],
  moderator: ['action:move', 'action:observe', 'action:speak', 'action:interact', 'world:moderate'],
};

/**
 * Cria uma instância de Principal com permissões padrão inferidas de seus papéis.
 */
export function createPrincipal(params: {
  id: string;
  type: PrincipalType;
  roles: PrincipalRole[];
  agentId?: string;
  displayName?: string;
  customPermissions?: string[];
  metadata?: Record<string, unknown>;
}): Principal {
  const permissionsSet = new Set<string>(params.customPermissions ?? []);
  for (const role of params.roles) {
    const rolePerms = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
    for (const p of rolePerms) {
      permissionsSet.add(p);
    }
  }

  return {
    id: params.id,
    type: params.type,
    roles: params.roles,
    permissions: Array.from(permissionsSet),
    agentId: params.agentId,
    displayName: params.displayName,
    metadata: params.metadata,
  };
}

// ── Contrato de Mente Subjetiva e Memória Hedônica (Task-036) ──
export interface AgentNeedsState {
  energy: number;
  hunger: number;
  social: number;
  curiosity: number;
  fun: number;
}

export interface AgentMemoryContextState {
  lastVisitedAt: Record<string, number>;
  visitCounts: Record<string, number>;
  actorAffinity?: Record<string, number>;
  placePreferences?: Record<string, number>;
  suggestedTargets?: Record<string, number>;
}

export interface AgentMindState {
  agentId: string;
  needs: AgentNeedsState;
  memory: AgentMemoryContextState;
  currentIntention?: Record<string, unknown> | null;
  currentActivity?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}
