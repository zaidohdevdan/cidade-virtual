import { describe, it, expect, vi } from 'vitest';
import { CognitiveCycleManager } from './index';
import type { CitizenId } from '@cidade-virtual/types';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';

describe('packages/agent-cognition — CognitiveCycleManager Unit Tests', () => {
  it('deve executar o ciclo cognitivo baseado em utilidade pura quando forceLLM não estiver ativo', async () => {
    const manager = new CognitiveCycleManager();

    const action = await manager.evaluateAction(
      'citizen-lyra' as CitizenId,
      'Caminhando pela calçada central observando as vitrines',
      'cafe-bistro',
      { relevantContext: ['Clima ensolarado', 'Horário de almoço'] },
    );

    expect(action).toBeDefined();
    expect(action.agentId).toBe('citizen-lyra');
    expect(action.actionType).toBe('autonomous_navigation');
    expect(action.targetId).toBe('cafe-bistro');
    expect(action.reasonCode).toBe('UTILITY_EVALUATION');
    expect(action.parameters.contextCount).toBeGreaterThanOrEqual(3); // Regra urbana + 2 do contexto
  });

  it('deve delegar a deliberação para o LLMAdapter quando forceLLM for true e houver adaptador', async () => {
    const mockLLM: LLMProviderAdapter = {
      isConfigured: () => true,
      complete: vi.fn().mockResolvedValue({
        content: 'Decido atravessar na faixa de pedestres em segurança.',
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      }),
    };

    const manager = new CognitiveCycleManager(mockLLM);

    const action = await manager.evaluateAction(
      'citizen-orion' as CitizenId,
      'Obstáculo inesperado na pista de rolamento',
      undefined,
      { forceLLM: true },
    );

    expect(mockLLM.complete).toHaveBeenCalled();
    expect(action.agentId).toBe('citizen-orion');
    expect(action.actionType).toBe('llm_deliberated_action');
    expect(action.reasonCode).toBe('LLM_REASONING');
    expect(action.parameters.response).toContain('Decido atravessar na faixa');
  });

  it('deve emitir ActionRequest assinado com Principal canônico (Task-025)', async () => {
    const manager = new CognitiveCycleManager();

    const request = await manager.evaluateActionRequest(
      'citizen-vega' as CitizenId,
      'Observando o semáforo',
      'crosswalk-01',
    );

    expect(request.principal).toBeDefined();
    expect(request.principal.type).toBe('npc');
    expect(request.principal.agentId).toBe('citizen-vega');
    expect(request.principal.roles).toContain('citizen');
    expect(request.actionType).toBe('autonomous_navigation');
    expect(request.targetId).toBe('crosswalk-01');
    expect(request.correlationId).toBeDefined();
    expect(request.timestamp).toBeDefined();
  });
});
