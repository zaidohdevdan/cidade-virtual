// packages/agent-planning/plan-evaluator.ts
// Avaliador de progresso, viabilidade e conclusão de planos

import type { Plan, PlanStep, StepStatus } from './types.js';

export interface PlanEvaluationResult {
  isViable: boolean;
  completionRate: number; // 0.0 a 1.0
  activeStep?: PlanStep;
  completedStepsCount: number;
  totalStepsCount: number;
  estimatedRemainingMs: number;
}

export class PlanEvaluator {
  evaluateProgress(plan: Plan): PlanEvaluationResult {
    const total = plan.steps.length;
    if (total === 0) {
      return {
        isViable: false,
        completionRate: 0,
        completedStepsCount: 0,
        totalStepsCount: 0,
        estimatedRemainingMs: 0,
      };
    }

    const completed = plan.steps.filter((s) => s.status === 'completed').length;
    const active = plan.steps.find((s) => s.status === 'in_progress' || s.status === 'pending');
    const remainingMs = plan.steps
      .filter((s) => s.status === 'pending' || s.status === 'in_progress')
      .reduce((sum, s) => sum + (s.estimatedDurationMs ?? 2000), 0);

    const isViable = plan.status !== 'failed' && plan.confidence >= 0.3;

    return {
      isViable,
      completionRate: Number((completed / total).toFixed(2)),
      activeStep: active,
      completedStepsCount: completed,
      totalStepsCount: total,
      estimatedRemainingMs: remainingMs,
    };
  }

  updateStepStatus(plan: Plan, stepIndex: number, status: StepStatus): Plan {
    const updatedSteps = plan.steps.map((step) => {
      if (step.stepIndex === stepIndex) {
        return { ...step, status };
      }
      return step;
    });

    const allCompleted = updatedSteps.every((s) => s.status === 'completed');
    const anyFailed = updatedSteps.some((s) => s.status === 'failed');

    let newStatus = plan.status;
    if (allCompleted) {
      newStatus = 'completed';
    } else if (anyFailed) {
      newStatus = 'failed';
    } else if (updatedSteps.some((s) => s.status === 'in_progress')) {
      newStatus = 'executing';
    }

    return {
      ...plan,
      steps: updatedSteps,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
  }
}
