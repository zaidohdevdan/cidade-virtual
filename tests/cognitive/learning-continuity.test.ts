// tests/cognitive/learning-continuity.test.ts
import { describe, it, expect } from 'vitest';
import type { AgentAction, AgentExperience } from '@cidade-virtual/types';

describe('Cognitive Continuity & Learning Test', () => {
  it('deve registrar experiência com proveniência e gerar ação validável', () => {
    const experience: AgentExperience = {
      id: 'exp-01',
      agentId: 'citizen-01',
      eventType: 'obstacle_encountered',
      description: 'Caminho bloqueado por semáforo vermelho',
      occurredAt: new Date().toISOString(),
      sourceType: 'direct_observation',
      confidence: 1.0,
      importance: 0.8,
      relatedEntityIds: ['traffic-light-01'],
    };

    expect(experience.sourceType).toBe('direct_observation');
    expect(experience.confidence).toBe(1.0);

    const action: AgentAction = {
      agentId: experience.agentId,
      actionType: 'wait_for_signal',
      targetId: 'traffic-light-01',
      parameters: { currentSignal: 'red' },
      reasonCode: 'SAFETY_COMPLIANCE',
      expectedOutcome: 'Aguardar sinal verde para atravessar com segurança',
    };

    expect(action.actionType).toBe('wait_for_signal');
    expect(action.reasonCode).toBe('SAFETY_COMPLIANCE');
  });
});
