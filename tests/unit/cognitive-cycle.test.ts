import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitiveCycleManager } from '../../packages/agent-cognition';
import type { CitizenId } from '@cidade-virtual/types';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import { metrics } from '@cidade-virtual/observability';

describe('tests/unit/cognitive-cycle.test.ts — CognitiveCycleManager com LLM Mockado', () => {
  let mockLLM: LLMProviderAdapter;

  beforeEach(() => {
    mockLLM = {
      isConfigured: vi.fn().mockReturnValue(true),
      complete: vi.fn().mockResolvedValue({
        content: 'Decido contornar o semáforo fechado e aguardar na calçada de pedestres.',
        usage: { promptTokens: 42, completionTokens: 18, totalTokens: 60 },
      }),
    };
  });

  it('deve orquestrar o ciclo cognitivo completo com LLM quando forceLLM for solicitado', async () => {
    const initialLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;
    const manager = new CognitiveCycleManager(mockLLM);

    const action = await manager.evaluateAction(
      'citizen-sheliak' as CitizenId,
      'Veículo em alta velocidade bloqueia a faixa de travessia',
      'crosswalk-central',
      {
        relevantContext: ['Semáforo de veículos verde', 'Chuva moderada'],
        forceLLM: true,
      },
    );

    expect(mockLLM.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Veículo em alta velocidade'),
        systemPrompt: expect.stringContaining('módulo deliberativo'),
      }),
    );

    expect(action).toBeDefined();
    expect(action.agentId).toBe('citizen-sheliak');
    expect(action.actionType).toBe('llm_deliberated_action');
    expect(action.targetId).toBe('crosswalk-central');
    expect(action.reasonCode).toBe('LLM_REASONING');
    expect(action.parameters.response).toBe(
      'Decido contornar o semáforo fechado e aguardar na calçada de pedestres.',
    );

    const finalLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;
    expect(finalLLMCalls).toBe(initialLLMCalls + 1);
  });

  it('deve tomar decisão autônoma por utilidade urbana quando forceLLM for falso', async () => {
    const initialLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;
    const manager = new CognitiveCycleManager(mockLLM);

    const action = await manager.evaluateAction(
      'citizen-sulafat' as CitizenId,
      'Caminhando tranquilamente pela calçada leste',
      'market-central',
      {
        relevantContext: ['Dia ensolarado'],
        forceLLM: false,
      },
    );

    // Não deve acionar LLM
    expect(mockLLM.complete).not.toHaveBeenCalled();
    expect(action.agentId).toBe('citizen-sulafat');
    expect(action.actionType).toBe('autonomous_navigation');
    expect(action.targetId).toBe('market-central');
    expect(action.reasonCode).toBe('UTILITY_EVALUATION');

    const finalLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;
    expect(finalLLMCalls).toBe(initialLLMCalls);
  });

  it('deve gerar ActionRequest canônico com Principal para validação de segurança no Gateway', async () => {
    const manager = new CognitiveCycleManager(mockLLM);

    const request = await manager.evaluateActionRequest(
      'citizen-vega' as CitizenId,
      'Aguardando pedestres passarem antes de avançar',
      'sidewalk-north',
    );

    expect(request.principal).toBeDefined();
    expect(request.principal.type).toBe('npc');
    expect(request.principal.agentId).toBe('citizen-vega');
    expect(request.principal.roles).toEqual(['citizen']);
    expect(request.correlationId).toBeDefined();
    expect(request.timestamp).toBeDefined();
    expect(request.actionType).toBe('autonomous_navigation');
  });

  it('deve manter operação íntegra mesmo sem adaptador de LLM configurado', async () => {
    const manager = new CognitiveCycleManager(undefined);

    const action = await manager.evaluateAction(
      'citizen-aladfar' as CitizenId,
      'Explorando os arredores da praça',
      undefined,
      { forceLLM: true }, // Mesmo forçando, sem adapter faz fallback para utilidade
    );

    expect(action).toBeDefined();
    expect(action.agentId).toBe('citizen-aladfar');
    expect(action.reasonCode).toBe('UTILITY_EVALUATION');
  });
});
