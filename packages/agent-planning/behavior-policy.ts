// packages/agent-planning/behavior-policy.ts
// Regras de conformidade e priorização de metas baseadas no arquétipo do cidadão

import type { BehaviorPolicyRule } from './types.js';

export class BehaviorPolicy {
  private readonly rules: BehaviorPolicyRule[] = [
    {
      archetype: 'guard',
      allowedGoals: ['patrulhar', 'vigiar', 'manter_ordem', 'inspecionar', 'ir_a_praca', 'rotina'],
      priorityMultiplier: 1.2,
    },
    {
      archetype: 'worker',
      allowedGoals: ['trabalhar', 'construir', 'consertar', 'ir_ao_trabalho', 'ir_a_praca', 'rotina'],
      priorityMultiplier: 1.1,
    },
    {
      archetype: 'citizen',
      allowedGoals: ['ir_a_praca', 'comprar', 'passear', 'visitar', 'rotina', 'descansar'],
      priorityMultiplier: 1.0,
    },
    {
      archetype: 'child',
      allowedGoals: ['brincar', 'ir_a_praca', 'estudar', 'passear', 'rotina'],
      restrictedGoals: ['patrulhar', 'operar_maquina', 'comprar_alto_valor'],
      priorityMultiplier: 0.9,
    },
    {
      archetype: 'elder',
      allowedGoals: ['caminhar_lento', 'ir_a_praca', 'conversar', 'rotina', 'descansar'],
      priorityMultiplier: 1.0,
    },
  ];

  isGoalAllowed(archetype: string, goal: string): boolean {
    const goalNorm = goal.toLowerCase();
    const rule = this.rules.find((r) => r.archetype === archetype);
    if (!rule) return true; // arquétipo livre por padrão

    if (rule.restrictedGoals?.some((r) => goalNorm.includes(r.toLowerCase()))) {
      return false;
    }

    return true;
  }

  getPriorityMultiplier(archetype?: string): number {
    if (!archetype) return 1.0;
    const rule = this.rules.find((r) => r.archetype === archetype);
    return rule ? rule.priorityMultiplier : 1.0;
  }
}
