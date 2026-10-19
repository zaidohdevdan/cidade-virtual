// tests/unit/goal-planner.test.ts
// Testes de conformidade da Task-014 (GoalPlanner real) e critérios de aceite

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GoalPlanner,
  InMemoryProceduralMemoryStore,
  PlanRevisionService,
} from '@cidade-virtual/agent-planning';

describe('Task-014 — GoalPlanner Real & Procedural Cache', () => {
  let planner: GoalPlanner;
  let memory: InMemoryProceduralMemoryStore;

  beforeEach(() => {
    memory = new InMemoryProceduralMemoryStore();
    planner = new GoalPlanner({
      proceduralMemory: memory,
      revisionService: new PlanRevisionService(),
    });
  });

  it('Critério 1: Plano de "ir à praça" gera ≥4 passos distintos (navegar, evitar obstáculo, atravessar faixa, chegar)', async () => {
    const plan = await planner.generatePlan('ir à praça');

    expect(plan.steps.length).toBeGreaterThanOrEqual(4);

    const actions = plan.steps.map((s) => s.action);
    expect(actions).toContain('navigate_to_waypoint');
    expect(actions).toContain('avoid_obstacles');
    expect(actions).toContain('cross_pedestrian_walkway');
    expect(actions).toContain('arrive_at_destination');
  });

  it('Critério 2: Plano reutilizado após sucesso tem confidence maior que a primeira execução', async () => {
    const firstPlan = await planner.generatePlan('ir à praça');
    const firstConfidence = firstPlan.confidence;

    await planner.recordPlanSuccess(firstPlan);

    const secondPlan = await planner.generatePlan('ir à praça');
    expect(secondPlan.strategy).toBe('procedural_cache');
    expect(secondPlan.confidence).toBeGreaterThan(firstConfidence);
  });

  it('Critério 3: PlanRevisionService replaneja com contingência de desvio diante de falha por obstáculo', async () => {
    const plan = await planner.generatePlan('ir à praça');
    const revised = await planner.recordPlanFailure(plan, 2, 'OBSTACLE_BLOCKED: entulho na calçada');

    expect(revised.status).toBe('revised');
    expect(revised.steps.some((s) => s.action === 'avoid_obstacle_detour')).toBe(true);
  });
});
