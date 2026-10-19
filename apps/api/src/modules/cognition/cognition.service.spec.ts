import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitionService } from './cognition.service';
import type { MemoryService } from '../memory/memory.service';
import type { ExperienceRepository } from '@cidade-virtual/persistence';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import type { CitizenId } from '@cidade-virtual/types';
import { metrics } from '@cidade-virtual/observability';

describe('CognitionService — Ciclo Cognitivo Real (Task-004)', () => {
  let cognitionService: CognitionService;
  let mockMemoryService: MemoryService;
  let mockExpRepo: ExperienceRepository;
  let mockLLMAdapter: LLMProviderAdapter;

  beforeEach(() => {
    mockMemoryService = {
      semanticQuery: vi.fn().mockResolvedValue([
        {
          id: 'mem-1',
          citizenId: 'citizen-1' as CitizenId,
          memoryType: 'episodic',
          content: 'Vi o semáforo ficar vermelho e pedestres aguardando.',
          embedding: [],
          timestamp: new Date(),
          sensoryTags: ['visual'],
          emotionalWeight: 0.9,
          origin: 'observation',
        },
      ]),
    } as unknown as MemoryService;

    mockExpRepo = {
      record: vi.fn().mockResolvedValue({ id: 'exp-123' }),
    } as unknown as ExperienceRepository;

    mockLLMAdapter = {
      complete: vi.fn().mockResolvedValue({
        content: 'Decidi aguardar o sinal abrir antes de atravessar.',
      }),
    };

    cognitionService = new CognitionService(mockMemoryService, mockExpRepo, mockLLMAdapter);
  });

  it('deve executar ação rotineira determinística sem chamar LLM', async () => {
    const initialLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;

    const action = await cognitionService.processCycle({
      citizenId: 'citizen-test-1' as CitizenId,
      currentObservation: 'Caminhando pela calçada em direção ao trabalho',
      nearbyObjects: ['calcada-central', 'poste-luz'],
      activeGoal: 'chegar ao trabalho',
    });

    expect(action).toBeDefined();
    expect(action.agentId).toBe('citizen-test-1');
    expect(action.reasonCode).toBe('ROUTINE_POLICY');
    expect(mockMemoryService.semanticQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        citizenId: 'citizen-test-1',
        queryText: 'Caminhando pela calçada em direção ao trabalho',
      }),
    );
    expect(mockExpRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'citizen-test-1',
        sourceType: 'action_result',
      }),
    );
    // Não deve chamar LLM para rotina
    expect(mockLLMAdapter.complete).not.toHaveBeenCalled();
    const finalLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;
    expect(finalLLMCalls).toBe(initialLLMCalls);
  });

  it('deve deliberar via LLM e incrementar métricas quando forçado ou necessário', async () => {
    const initialLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;

    const action = await cognitionService.processCycle(
      {
        citizenId: 'citizen-test-2' as CitizenId,
        currentObservation: 'Um objeto incomum bloqueia a travessia na via',
        nearbyObjects: ['objeto-misterioso'],
      },
      { forceLLM: true },
    );

    expect(action).toBeDefined();
    expect(action.reasonCode).toBe('LLM_REASONING');
    expect(action.actionType).toBe('llm_deliberated_action');
    expect(mockLLMAdapter.complete).toHaveBeenCalled();

    const finalLLMCalls = metrics.getSnapshot().counters['llm.calls'] ?? 0;
    expect(finalLLMCalls).toBe(initialLLMCalls + 1);

    expect(mockExpRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'citizen-test-2',
        sourceType: 'action_result',
      }),
    );
  });

  it('deve gerar diálogo conversacional via LLM enriquecido com memórias e arquétipo', async () => {
    (mockLLMAdapter.complete as any).mockResolvedValueOnce({
      content: 'Olá Daniel! A patrulha da via principal está operando com total atenção.',
    });

    const dialogue = await cognitionService.generateConversationalDialogue({
      citizenId: 'agent-vega' as CitizenId,
      citizenName: 'Vega',
      citizenRole: 'Pioneira & Navegadora de Segurança',
      starDesignation: 'Alpha Lyrae',
      backstorySeed: 'Responsável pela segurança viária.',
      activeGoals: ['monitorar trânsito'],
      playerMessage: 'Como estão as ruas hoje?',
      trafficLight: 'green',
    });

    expect(dialogue).toBe('Olá Daniel! A patrulha da via principal está operando com total atenção.');
    expect(mockMemoryService.semanticQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        citizenId: 'agent-vega',
        queryText: 'Como estão as ruas hoje?',
      }),
    );
    expect(mockLLMAdapter.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Como estão as ruas hoje?'),
        systemPrompt: expect.stringContaining('Vega'),
      }),
    );
  });

  it('deve retornar null no diálogo conversacional se não houver adaptador de LLM', async () => {
    const serviceWithoutLLM = new CognitionService(mockMemoryService, mockExpRepo, undefined);

    const dialogue = await serviceWithoutLLM.generateConversationalDialogue({
      citizenId: 'agent-vega' as CitizenId,
      citizenName: 'Vega',
      citizenRole: 'Pioneira & Navegadora de Segurança',
      starDesignation: 'Alpha Lyrae',
      backstorySeed: 'Responsável pela segurança viária.',
      activeGoals: ['monitorar trânsito'],
      playerMessage: 'Como estão as ruas hoje?',
      trafficLight: 'green',
    });

    expect(dialogue).toBeNull();
  });
});

