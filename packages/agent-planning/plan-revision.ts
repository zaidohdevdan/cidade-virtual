// packages/agent-planning/plan-revision.ts
// Serviço de revisão e contingência de planos para contorno de falhas e obstáculos

import type { Plan, PlanRevisionRequest, PlanStep } from './types.js';

export class PlanRevisionService {
  /**
   * Revisa um plano interrompido ou falho, injetando passos de contingência ou rotas alternativas.
   */
  revisePlan(request: PlanRevisionRequest): Plan {
    const { plan, failedStepIndex, reason, context } = request;
    const originalSteps = plan.steps;

    // Localiza o passo que falhou
    const failedStep = originalSteps.find((s) => s.stepIndex === failedStepIndex);
    const prefixSteps = originalSteps.filter((s) => s.stepIndex < failedStepIndex);
    const remainingSteps = originalSteps.filter((s) => s.stepIndex > failedStepIndex);

    const contingencySteps: PlanStep[] = [];
    const reasonLower = reason.toLowerCase();

    if (reasonLower.includes('obstac') || reasonLower.includes('bloque') || reasonLower.includes('veiculo')) {
      contingencySteps.push({
        stepIndex: 0,
        action: 'avoid_obstacle_detour',
        target: failedStep?.target ?? 'Detour_Zone',
        description: `Contorno imediato de obstáculo em rota (${reason})`,
        parameters: { detourRadius: 2.5, originalFailedStep: failedStepIndex, context },
        status: 'pending',
        estimatedDurationMs: 3000,
      });
      // Re-adiciona o passo original para ser tentado novamente após o desvio
      if (failedStep) {
        contingencySteps.push({
          ...failedStep,
          status: 'pending',
          description: `${failedStep.description} (retomada pós-desvio)`,
        });
      }
    } else if (reasonLower.includes('semaphor') || reasonLower.includes('sinal') || reasonLower.includes('red') || reasonLower.includes('traffic')) {
      contingencySteps.push({
        stepIndex: 0,
        action: 'wait_for_green_signal',
        target: 'Crosswalk_Sidewalk_Buffer',
        description: 'Aguardar na calçada até o semáforo veicular liberar travessia segura',
        parameters: { minimumWaitMs: 3000, complianceRule: 'DENATRAN_SAFETY' },
        status: 'pending',
        estimatedDurationMs: 4000,
      });
      if (failedStep) {
        contingencySteps.push({
          ...failedStep,
          status: 'pending',
          description: `${failedStep.description} (execução com sinal verde)`,
        });
      }
    } else {
      // Falha genérica: reorientar e reavaliar rota
      contingencySteps.push({
        stepIndex: 0,
        action: 'recalibrate_route',
        target: failedStep?.target,
        description: `Recalibrar rota urbana após ocorrência: ${reason}`,
        parameters: { reason, context },
        status: 'pending',
        estimatedDurationMs: 2000,
      });
      if (failedStep) {
        contingencySteps.push({
          ...failedStep,
          status: 'pending',
          description: `${failedStep.description} (após recalibração)`,
        });
      }
    }

    // Monta todos os passos re-indexando de 1 a N
    const allRevisedSteps: PlanStep[] = [
      ...prefixSteps.map((s) => ({ ...s, status: 'completed' as const })),
      ...contingencySteps,
      ...remainingSteps.map((s) => ({ ...s, status: 'pending' as const })),
    ].map((step, idx) => ({
      ...step,
      stepIndex: idx + 1,
    }));

    return {
      ...plan,
      steps: allRevisedSteps,
      status: 'revised',
      confidence: Math.max(0.4, Number((plan.confidence * 0.9).toFixed(2))),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...plan.metadata,
        lastRevisionReason: reason,
        failedStepIndex,
        revisedAt: new Date().toISOString(),
      },
    };
  }
}
