// packages/agent-planning/goal-planner.ts
// Orquestrador central de planejamento: HTN, LLM, Memória Procedural e Contingência

import { randomUUID } from 'node:crypto';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import type {
  Plan,
  PlanStep,
  GoalPlanningOptions,
  ProceduralMemoryStore,
} from './types.js';
import { InMemoryProceduralMemoryStore, normalizeGoalKey } from './memory-store.js';
import { HTNDecomposer } from './htn-decomposer.js';
import { PlanRevisionService } from './plan-revision.js';
import { BehaviorPolicy } from './behavior-policy.js';
import { PlanEvaluator } from './plan-evaluator.js';

export class GoalPlanner {
  private readonly proceduralMemory: ProceduralMemoryStore;
  private readonly htnDecomposer: HTNDecomposer;
  private readonly revisionService: PlanRevisionService;
  private readonly behaviorPolicy: BehaviorPolicy;
  private readonly evaluator: PlanEvaluator;
  private llmAdapter?: LLMProviderAdapter;

  constructor(options?: {
    proceduralMemory?: ProceduralMemoryStore;
    llmAdapter?: LLMProviderAdapter;
    revisionService?: PlanRevisionService;
    behaviorPolicy?: BehaviorPolicy;
    evaluator?: PlanEvaluator;
  }) {
    this.proceduralMemory = options?.proceduralMemory ?? new InMemoryProceduralMemoryStore();
    this.htnDecomposer = new HTNDecomposer();
    this.revisionService = options?.revisionService ?? new PlanRevisionService();
    this.behaviorPolicy = options?.behaviorPolicy ?? new BehaviorPolicy();
    this.evaluator = options?.evaluator ?? new PlanEvaluator();
    this.llmAdapter = options?.llmAdapter;
  }

  /**
   * Define ou atualiza o adaptador de LLM para planejamento deliberativo.
   */
  setLLMAdapter(adapter?: LLMProviderAdapter): void {
    this.llmAdapter = adapter;
  }

  /**
   * Retorna a memória procedural ativa.
   */
  getProceduralMemory(): ProceduralMemoryStore {
    return this.proceduralMemory;
  }

  /**
   * Gera um plano estruturado para atingir um objetivo urbano.
   * Prioridade:
   * 1. Memória procedural (se não forçado fresh e plano já demonstrou eficácia)
   * 2. Deliberação via LLM (se solicitado explicitamente ou meta desconhecida complexa)
   * 3. Decomposição hierárquica HTN determinística
   */
  async generatePlan(goal: string, options?: GoalPlanningOptions): Promise<Plan> {
    const memory = options?.proceduralMemory ?? this.proceduralMemory;
    const goalKey = normalizeGoalKey(goal);

    // 1. Reutilização de estratégias da Memória Procedural
    if (!options?.forceFresh) {
      const cachedPlan = await memory.get(goalKey);
      if (cachedPlan && cachedPlan.successCount > 0) {
        return {
          ...cachedPlan,
          id: randomUUID(),
          agentId: options?.agentId ?? cachedPlan.agentId,
          strategy: 'procedural_cache',
          status: 'draft',
          steps: cachedPlan.steps.map((s) => ({ ...s, status: 'pending' })),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    // 2. Deliberação via LLM (se configurado e solicitado)
    const activeLLM = options?.llmAdapter ?? this.llmAdapter;
    if (options?.requiresLLM && activeLLM) {
      try {
        const llmPlan = await this.planWithLLM(goal, activeLLM, options);
        if (llmPlan) {
          return llmPlan;
        }
      } catch {
        // Fallback para HTN em caso de falha de inferência
      }
    }

    // 3. Decomposição HTN determinística
    const steps = this.htnDecomposer.decompose(goal, options?.context);
    const now = new Date().toISOString();

    const plan: Plan = {
      id: randomUUID(),
      goal,
      agentId: options?.agentId,
      steps,
      confidence: 0.75,
      strategy: 'htn_decomposition',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      executionsCount: 0,
      successCount: 0,
      metadata: {
        decomposedBy: 'HTNDecomposer',
        context: options?.context,
      },
    };

    return plan;
  }

  /**
   * Versão síncrona determinística usando decomposição HTN.
   */
  generatePlanSync(goal: string, options?: GoalPlanningOptions): Plan {
    const steps = this.htnDecomposer.decompose(goal, options?.context);
    const now = new Date().toISOString();

    return {
      id: randomUUID(),
      goal,
      agentId: options?.agentId,
      steps,
      confidence: 0.75,
      strategy: 'htn_decomposition',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      executionsCount: 0,
      successCount: 0,
      metadata: {
        decomposedBy: 'HTNDecomposer',
        sync: true,
      },
    };
  }

  /**
   * Registra a execução bem-sucedida de um plano.
   * Eleva a confiança da estratégia na memória procedural para futuras execuções.
   */
  async recordPlanSuccess(plan: Plan): Promise<Plan> {
    const memory = this.proceduralMemory;
    const goalKey = normalizeGoalKey(plan.goal);

    const executions = plan.executionsCount + 1;
    const successes = plan.successCount + 1;
    // Boost de confiança proporcional ao histórico de sucessos
    const boost = 0.15;
    const newConfidence = Math.min(0.99, Number((plan.confidence + boost).toFixed(2)));

    const updatedPlan: Plan = {
      ...plan,
      confidence: newConfidence,
      executionsCount: executions,
      successCount: successes,
      status: 'completed',
      updatedAt: new Date().toISOString(),
      steps: plan.steps.map((s) => ({ ...s, status: 'completed' })),
    };

    await memory.set(goalKey, updatedPlan);
    return updatedPlan;
  }

  /**
   * Registra a interrupção ou falha de um passo, acionando o PlanRevisionService.
   */
  async recordPlanFailure(plan: Plan, failedStepIndex: number, reason: string): Promise<Plan> {
    const revised = this.revisionService.revisePlan({
      plan,
      failedStepIndex,
      reason,
    });
    return revised;
  }

  /**
   * Decompõe objetivo através de LLM com prompt estruturado.
   */
  private async planWithLLM(
    goal: string,
    llm: LLMProviderAdapter,
    options?: GoalPlanningOptions,
  ): Promise<Plan | null> {
    const prompt = `Decomponha o seguinte objetivo de um agente em uma cidade virtual em 4 a 6 passos operacionais JSON:
Objetivo: "${goal}"
Ambiente: Cidade Virtual 3D com pedestres, carros, semáforo e cruzamentos.
Formato de resposta: JSON puro array de passos:
[
  { "stepIndex": 1, "action": "nome_acao", "target": "alvo", "description": "descricao", "estimatedDurationMs": 2000 }
]`;

    const res = await llm.complete({
      prompt,
      systemPrompt: 'Você é um planejador hierárquico HTN para agentes em cidades virtuais. Responda apenas JSON.',
      temperature: 0.2,
    });

    const parsed = this.parseLLMSteps(res.content, goal);
    if (!parsed || parsed.length === 0) return null;

    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      goal,
      agentId: options?.agentId,
      steps: parsed,
      confidence: 0.80,
      strategy: 'llm_deliberation',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      executionsCount: 0,
      successCount: 0,
      metadata: {
        deliberatedByLLM: true,
      },
    };
  }

  private parseLLMSteps(rawContent: string, goal: string): PlanStep[] | null {
    try {
      const jsonStart = rawContent.indexOf('[');
      const jsonEnd = rawContent.lastIndexOf(']');
      if (jsonStart === -1 || jsonEnd === -1) return null;

      const slice = rawContent.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(slice);

      if (!Array.isArray(parsed)) return null;

      return parsed.map((item: any, idx: number) => ({
        stepIndex: idx + 1,
        action: String(item.action || `step_${idx + 1}`),
        target: item.target ? String(item.target) : undefined,
        description: String(item.description || item.action || `Passo ${idx + 1} para ${goal}`),
        estimatedDurationMs: Number(item.estimatedDurationMs || 2500),
        status: 'pending' as const,
      }));
    } catch {
      return null;
    }
  }
}
