// packages/agent-planning/types.ts
// SYNAPSE CITY ENGINE — Tipos canônicos de Planejamento e Decomposição de Metas
// Alinhado ao SKILL.md Seção 3.5 e Task-014

import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface PlanStep {
  stepIndex: number;
  action: string;
  target?: string;
  description: string;
  parameters?: Record<string, unknown>;
  status?: StepStatus;
  estimatedDurationMs?: number;
}

export type PlanStrategy =
  | 'htn_decomposition'
  | 'procedural_cache'
  | 'llm_deliberation'
  | 'reactive_fallback';

export type PlanStatus = 'draft' | 'executing' | 'completed' | 'failed' | 'revised';

export interface Plan {
  id: string;
  goal: string;
  agentId?: string;
  steps: PlanStep[];
  confidence: number;
  strategy: PlanStrategy;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  executionsCount: number;
  successCount: number;
  metadata?: Record<string, unknown>;
}

export interface ProceduralMemoryStore {
  get(goalKey: string): Promise<Plan | null> | Plan | null;
  set(goalKey: string, plan: Plan): Promise<void> | void;
  delete?(goalKey: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface GoalPlanningOptions {
  agentId?: string;
  forceFresh?: boolean;
  requiresLLM?: boolean;
  llmAdapter?: LLMProviderAdapter;
  proceduralMemory?: ProceduralMemoryStore;
  currentLocation?: string;
  obstacles?: string[];
  trafficLightSignal?: 'green' | 'yellow' | 'red';
  context?: Record<string, unknown>;
}

export interface PlanRevisionRequest {
  plan: Plan;
  failedStepIndex: number;
  reason: string;
  context?: Record<string, unknown>;
}

export interface BehaviorPolicyRule {
  archetype: 'worker' | 'guard' | 'citizen' | 'child' | 'elder' | 'all';
  allowedGoals: string[];
  restrictedGoals?: string[];
  priorityMultiplier: number;
}
