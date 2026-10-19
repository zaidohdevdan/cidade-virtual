// packages/agent-planning/goal-planner.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GoalPlanner,
  InMemoryProceduralMemoryStore,
  HTNDecomposer,
  PlanRevisionService,
  BehaviorPolicy,
  PlanEvaluator,
} from './index.js';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';

describe('GoalPlanner (Task-014 — Planejamento Real e Memória Procedural)', () => {
  let planner: GoalPlanner;
  let memory: InMemoryProceduralMemoryStore;
  let decomposer: HTNDecomposer;
  let revisionService: PlanRevisionService;

  beforeEach(() => {
    memory = new InMemoryProceduralMemoryStore();
    decomposer = new HTNDecomposer();
    revisionService = new PlanRevisionService();
    planner = new GoalPlanner({
      proceduralMemory: memory,
      revisionService,
    });
  });

  describe('Decomposição HTN de Metas Urbanas', () => {
    it('deve gerar plano de "ir à praça" com ≥4 passos distintos (navegar, evitar obstáculo, atravessar faixa, chegar)', async () => {
      const plan = await planner.generatePlan('ir à praça');

      expect(plan).toBeDefined();
      expect(plan.goal).toBe('ir à praça');
      expect(plan.strategy).toBe('htn_decomposition');
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);

      const actions = plan.steps.map((s) => s.action);
      // Critério: navegar, evitar obstáculo, atravessar faixa, chegar
      expect(actions).toContain('observe_environment');
      expect(actions).toContain('navigate_to_waypoint');
      expect(actions).toContain('avoid_obstacles');
      expect(actions).toContain('cross_pedestrian_walkway');
      expect(actions).toContain('arrive_at_destination');

      // Verifica se todos os passos possuem descrições claras e índices ordenados
      plan.steps.forEach((step, index) => {
        expect(step.stepIndex).toBe(index + 1);
        expect(step.description.length).toBeGreaterThan(5);
        expect(step.status).toBe('pending');
      });
    });

    it('deve decompor variações de texto para praça com a mesma eficácia', async () => {
      const plan1 = await planner.generatePlan('visitar a praça central');
      const plan2 = await planner.generatePlan('caminhar até a praca');

      expect(plan1.steps.length).toBeGreaterThanOrEqual(4);
      expect(plan2.steps.length).toBeGreaterThanOrEqual(4);
      expect(plan1.steps.some((s) => s.action === 'cross_pedestrian_walkway')).toBe(true);
      expect(plan2.steps.some((s) => s.action === 'cross_pedestrian_walkway')).toBe(true);
    });

    it('deve decompor metas de patrulha e trabalho em sequências operacionais', async () => {
      const patrolPlan = await planner.generatePlan('patrulhar a avenida');
      expect(patrolPlan.steps.length).toBe(4);
      expect(patrolPlan.steps.map((s) => s.action)).toContain('monitor_traffic_compliance');

      const workPlan = await planner.generatePlan('ir ao trabalho na oficina');
      expect(workPlan.steps.length).toBe(4);
      expect(workPlan.steps.map((s) => s.action)).toContain('cross_crosswalk_safely');
    });

    it('deve decompor metas genéricas em no mínimo 4 passos', async () => {
      const genericPlan = await planner.generatePlan('explorar novo beco da cidade');
      expect(genericPlan.steps.length).toBeGreaterThanOrEqual(4);
      expect(genericPlan.steps[0].action).toBe('survey_route');
      expect(genericPlan.steps[genericPlan.steps.length - 1].action).toBe('reach_target_goal');
    });
  });

  describe('Reutilização Procedural e Elevação de Confiança', () => {
    it('deve registrar sucesso do plano e elevar confidence quando reutilizado', async () => {
      // 1ª Execução: plano criado do zero
      const initialPlan = await planner.generatePlan('ir à praça');
      const initialConfidence = initialPlan.confidence;
      expect(initialPlan.strategy).toBe('htn_decomposition');
      expect(initialPlan.executionsCount).toBe(0);

      // Agente conclui com sucesso a execução
      const succeededPlan = await planner.recordPlanSuccess(initialPlan);
      expect(succeededPlan.status).toBe('completed');
      expect(succeededPlan.successCount).toBe(1);
      expect(succeededPlan.executionsCount).toBe(1);
      expect(succeededPlan.confidence).toBeGreaterThan(initialConfidence);

      // 2ª Execução: plano deve ser recuperado da memória procedural
      const reusedPlan = await planner.generatePlan('ir à praça');
      expect(reusedPlan.strategy).toBe('procedural_cache');
      expect(reusedPlan.confidence).toBeGreaterThan(initialConfidence);
      expect(reusedPlan.confidence).toBe(succeededPlan.confidence);
      expect(reusedPlan.steps.length).toBe(initialPlan.steps.length);
    });

    it('deve permitir forçar novo plano com forceFresh mesmo tendo plano em cache', async () => {
      const plan = await planner.generatePlan('ir à praça');
      await planner.recordPlanSuccess(plan);

      const freshPlan = await planner.generatePlan('ir à praça', { forceFresh: true });
      expect(freshPlan.strategy).toBe('htn_decomposition');
    });
  });

  describe('Revisão e Contingência de Planos (PlanRevisionService)', () => {
    it('deve revisar plano e injetar desvio ao encontrar obstáculo no caminho', async () => {
      const plan = await planner.generatePlan('ir à praça');
      // Suponha que o passo 2 falhou por obstáculo
      const revised = await planner.recordPlanFailure(plan, 2, 'OBSTACLE_BLOCKED: pedestre parado na calçada');

      expect(revised.status).toBe('revised');
      expect(revised.steps.some((s) => s.action === 'avoid_obstacle_detour')).toBe(true);
      expect(revised.metadata?.lastRevisionReason).toContain('OBSTACLE_BLOCKED');

      // O passo de desvio deve vir antes da retomada do passo 2
      const detourIndex = revised.steps.findIndex((s) => s.action === 'avoid_obstacle_detour');
      expect(detourIndex).toBeGreaterThan(-1);
      expect(revised.steps[detourIndex + 1].action).toBe('navigate_to_waypoint');
    });

    it('deve revisar plano e aguardar sinal verde quando semáforo fecha', async () => {
      const plan = await planner.generatePlan('ir à praça');
      // Suponha que o passo 4 (atravessar faixa) falhou por semáforo fechado
      const revised = await planner.recordPlanFailure(plan, 4, 'SIGNAL_RED: semáforo veicular em fluxo verde');

      expect(revised.status).toBe('revised');
      expect(revised.steps.some((s) => s.action === 'wait_for_green_signal')).toBe(true);
    });
  });

  describe('Deliberação via LLM Adapter', () => {
    it('deve decompor plano via LLM quando solicitado e adaptador estiver disponível', async () => {
      const mockLLM: LLMProviderAdapter = {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            { stepIndex: 1, action: 'scan_surroundings', description: 'Verificar local' },
            { stepIndex: 2, action: 'approach_target', description: 'Aproximar-se' },
            { stepIndex: 3, action: 'interact_object', description: 'Interagir com objeto' },
            { stepIndex: 4, action: 'verify_outcome', description: 'Verificar resultado' },
          ]),
        }),
      };

      const plan = await planner.generatePlan('investigar objeto misterioso', {
        requiresLLM: true,
        llmAdapter: mockLLM,
      });

      expect(plan.strategy).toBe('llm_deliberation');
      expect(plan.steps.length).toBe(4);
      expect(plan.steps[0].action).toBe('scan_surroundings');
      expect(mockLLM.complete).toHaveBeenCalled();
    });
  });

  describe('BehaviorPolicy & PlanEvaluator', () => {
    it('deve validar permissões e regras de arquétipos', () => {
      const policy = new BehaviorPolicy();
      expect(policy.isGoalAllowed('guard', 'patrulhar a avenida')).toBe(true);
      expect(policy.isGoalAllowed('child', 'patrulhar a avenida')).toBe(false);
      expect(policy.isGoalAllowed('child', 'brincar na praça')).toBe(true);
      expect(policy.getPriorityMultiplier('guard')).toBe(1.2);
    });

    it('deve avaliar progresso e viabilidade com PlanEvaluator', () => {
      const evaluator = new PlanEvaluator();
      const plan = planner.generatePlanSync('ir à praça');

      let evalResult = evaluator.evaluateProgress(plan);
      expect(evalResult.isViable).toBe(true);
      expect(evalResult.completionRate).toBe(0);
      expect(evalResult.completedStepsCount).toBe(0);

      const step1Done = evaluator.updateStepStatus(plan, 1, 'completed');
      evalResult = evaluator.evaluateProgress(step1Done);
      expect(evalResult.completedStepsCount).toBe(1);
      expect(evalResult.completionRate).toBeGreaterThan(0);
    });
  });
});
