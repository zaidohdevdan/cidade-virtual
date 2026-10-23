// apps/api/src/modules/simulation/simulation.service.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutonomousSimulationService } from './simulation.service';
import type { WorldGateway } from '../../gateways/world.gateway';
import type { CognitionService } from '../cognition/cognition.service';
import type { WorldService } from '../world/world.service';
import type {
  AgentIdentityRepository,
  ExperienceRepository,
  AgentMindRepository,
} from '@cidade-virtual/persistence';

describe('AutonomousSimulationService — Vida Urbana Autônoma', () => {
  let service: AutonomousSimulationService;
  let mockWorldGateway: {
    getTrafficLightState: ReturnType<typeof vi.fn>;
    broadcastDomainEvent: ReturnType<typeof vi.fn>;
    setSimulationService?: ReturnType<typeof vi.fn>;
    getClosestPlayer?: ReturnType<typeof vi.fn>;
  };
  let mockCognitionService: {
    processCycle: ReturnType<typeof vi.fn>;
    generateConversationalDialogue?: ReturnType<typeof vi.fn>;
    getLLMAdapter?: ReturnType<typeof vi.fn>;
  };
  let mockWorldService: {
    incrementTick: ReturnType<typeof vi.fn>;
  };
  let mockAgentRepo: {
    updateLocation: ReturnType<typeof vi.fn>;
  };
  let mockExpRepo: {
    record: ReturnType<typeof vi.fn>;
  };
  let mockAgentMindRepo: {
    listAll: ReturnType<typeof vi.fn>;
    saveAll: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    deleteByAgentId: ReturnType<typeof vi.fn>;
    deleteAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockWorldGateway = {
      getTrafficLightState: vi.fn().mockReturnValue('green'),
      broadcastDomainEvent: vi.fn(),
      setSimulationService: vi.fn(),
      getClosestPlayer: vi.fn().mockReturnValue(null),
    };

    mockCognitionService = {
      processCycle: vi.fn().mockResolvedValue({
        actionType: 'move',
        expectedOutcome: 'Avançando em direção ao objetivo',
        reasonCode: 'GOAL_EXECUTION',
      }),
      generateConversationalDialogue: vi.fn().mockResolvedValue(null),
      getLLMAdapter: vi.fn().mockReturnValue(undefined),
    };

    mockWorldService = {
      incrementTick: vi.fn().mockResolvedValue({ tickCount: 1 }),
    };

    mockAgentRepo = {
      updateLocation: vi.fn().mockResolvedValue({ id: 'agent-sulafat' }),
    };

    mockExpRepo = {
      record: vi.fn().mockResolvedValue({ id: 'exp-1' }),
    };

    mockAgentMindRepo = {
      listAll: vi.fn().mockResolvedValue([]),
      saveAll: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue({}),
      deleteByAgentId: vi.fn().mockResolvedValue(true),
      deleteAll: vi.fn().mockResolvedValue(undefined),
    };

    service = new AutonomousSimulationService(
      mockWorldGateway as unknown as WorldGateway,
      mockCognitionService as unknown as CognitionService,
      mockWorldService as unknown as WorldService,
      undefined,
      mockAgentRepo as unknown as AgentIdentityRepository,
      mockExpRepo as unknown as ExperienceRepository,
      mockAgentMindRepo as unknown as AgentMindRepository,
    );
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    vi.useRealTimers();
  });

  it('deve inicializar o único agente canônico (Sulafat) no runtime', async () => {
    await service.onModuleInit();

    const states = service.getAgentStates();
    expect(states.size).toBe(1);
    expect(states.has('agent-sulafat')).toBe(true);
  });

  it('deve avançar o tick e emitir agent.moved e agent.speech durante o passo de simulação quando jogador estiver próximo', async () => {
    mockWorldGateway.getClosestPlayer?.mockReturnValue({ distance: 2.1 });
    // Fala gerada pela mente via LLM (sem texto pré-fixado no serviço)
    mockCognitionService.generateConversationalDialogue?.mockResolvedValue('Olá Daniel, vim observar a praça.');
    await service.onModuleInit();

    await service.executeSimulationStep();

    expect(mockWorldService.incrementTick).toHaveBeenCalled();
    expect(mockWorldGateway.getTrafficLightState).toHaveBeenCalled();
    expect(mockCognitionService.processCycle).toHaveBeenCalled();

    // Deve emitir eventos de locomoção e fala para o frontend
    expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'agent.moved',
        payload: expect.objectContaining({
          agentId: expect.any(String),
          position: expect.objectContaining({
            x: expect.any(Number),
            z: expect.any(Number),
          }),
        }),
      }),
    );

    expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'agent.speech',
        payload: expect.objectContaining({
          agentId: expect.any(String),
          message: expect.any(String),
          isProximitySpeech: true,
        }),
      }),
    );
  });

  it('sem LLM disponível o agente permanece em silêncio (sem fala enlatada)', async () => {
    mockWorldGateway.getClosestPlayer?.mockReturnValue({ distance: 2.1 });
    mockCognitionService.generateConversationalDialogue?.mockResolvedValue(null);
    await service.onModuleInit();
    await service.executeSimulationStep();
    const speech = mockWorldGateway.broadcastDomainEvent.mock.calls.filter((c: any[]) => c[0]?.name === 'agent.speech');
    expect(speech).toHaveLength(0);
  });

  it('não deve emitir agent.speech quando o avatar Daniel estiver distante (> 3.5m)', async () => {
    mockWorldGateway.getClosestPlayer?.mockReturnValue({ distance: 12.0 });
    await service.onModuleInit();

    await service.executeSimulationStep();

    expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'agent.moved',
      }),
    );

    // Não deve disparar agent.speech se o jogador estiver longe
    const speechCalls = mockWorldGateway.broadcastDomainEvent.mock.calls.filter(
      (call: any[]) => call[0]?.name === 'agent.speech',
    );
    expect(speechCalls.length).toBe(0);
  });

  it('deve encerrar timers e persistir todas as mentes no onModuleDestroy', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(mockAgentMindRepo.saveAll).toHaveBeenCalled();
  });

  it('deve restaurar o estado hedônico e necessidades a partir do banco de dados no onModuleInit', async () => {
    mockAgentMindRepo.listAll.mockResolvedValue([
      {
        agentId: 'agent-sulafat',
        needs: { energy: 0.35, hunger: 0.8, social: 0.9, curiosity: 0.2, fun: 0.4 },
        memory: {
          lastVisitedAt: { 'cafe-bistro': 123456 },
          visitCounts: { 'cafe-bistro': 4 },
          placePreferences: { 'cafe-bistro': 0.75, 'market-central': -0.2 },
          actorAffinity: { 'avatar-daniel': 0.9 },
        },
        currentIntention: null,
        currentActivity: null,
      },
    ]);

    await service.onModuleInit();

    const vegaState = service.getAgentStates().get('agent-sulafat');
    expect(vegaState).toBeDefined();
    expect(vegaState?.mind.needs.energy).toBe(0.35);
    expect(vegaState?.mind.needs.hunger).toBe(0.8);
    expect(vegaState?.mind.memory.placePreferences?.['cafe-bistro']).toBe(0.75);
    expect(vegaState?.mind.memory.placePreferences?.['market-central']).toBe(-0.2);
    expect(vegaState?.mind.memory.actorAffinity?.['avatar-daniel']).toBe(0.9);
    expect(vegaState?.mind.memory.visitCounts?.['cafe-bistro']).toBe(4);
  });

  it('deve redefinir a mente do agente para os padrões de nascimento com resetMind', async () => {
    await service.onModuleInit();

    const vegaState = service.getAgentStates().get('agent-sulafat');
    if (vegaState) {
      vegaState.mind.memory.placePreferences = { 'market-central': 0.99 };
    }

    await service.resetMind('agent-sulafat');

    expect(mockAgentMindRepo.deleteByAgentId).toHaveBeenCalledWith('agent-sulafat');
    const resetVega = service.getAgentStates().get('agent-sulafat');
    expect(resetVega?.mind.memory.placePreferences?.['market-central']).toBeUndefined();
  });

  describe('handlePlayerDialogue — Assimilação Semântica e Obediência Imediata', () => {
    it('deve assimilar "vc deve evitar o café", recalcular rota para local seguro e emitir evento agent.target', async () => {
      await service.onModuleInit();

      const result = await service.handlePlayerDialogue('agent-sulafat', 'Você deve evitar o café', 'avatar-daniel');

      expect(result.directive).toBeDefined();
      expect(result.directive?.directiveType).toBe('avoid_place');
      expect(result.directive?.targetCategory).toBe('cafe');
      expect(result.response).toMatch(/evitar.*café|cancelada/i);

      // Deve ter gravado a mente no repositório de persistência
      expect(mockAgentMindRepo.upsert).toHaveBeenCalled();

      // Deve ter transmitido agent.target com o destino de escape (Praça Central)
      expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'agent.target',
          payload: expect.objectContaining({
            agentId: 'agent-sulafat',
            action: 'reroute',
            targetPosition: expect.objectContaining({ x: -22, z: 18 }),
          }),
        }),
      );
    });

    it('deve assimilar "use a faixa de pedestre" e direcionar imediatamente para a faixa', async () => {
      await service.onModuleInit();

      const result = await service.handlePlayerDialogue('agent-sulafat', 'Por favor use a faixa de pedestre', 'avatar-daniel');

      expect(result.directive?.directiveType).toBe('use_crosswalk');
      expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'agent.target',
          payload: expect.objectContaining({
            agentId: 'agent-sulafat',
            action: 'crosswalk',
          }),
        }),
      );
    });

    it('deve assimilar "vá para o mercado" e direcionar rota para o mercado central', async () => {
      await service.onModuleInit();

      const result = await service.handlePlayerDialogue('agent-sulafat', 'Vá para o mercado agora', 'avatar-daniel');

      expect(result.directive?.directiveType).toBe('go_to_place');
      expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'agent.target',
          payload: expect.objectContaining({
            agentId: 'agent-sulafat',
            action: 'goto',
            targetPosition: expect.objectContaining({ z: -36 }),
          }),
        }),
      );
    });

    it('deve assimilar "pare aí" e cancelar o destino ativo', async () => {
      await service.onModuleInit();

      const result = await service.handlePlayerDialogue('agent-sulafat', 'Pare imediatamente', 'avatar-daniel');

      expect(result.directive?.directiveType).toBe('wait_stop');
      const agentState = service.getAgentStates().get('agent-sulafat');
      expect(agentState?.targetDestination).toBeNull();
      expect(mockWorldGateway.broadcastDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'agent.target',
          payload: expect.objectContaining({
            agentId: 'agent-sulafat',
            action: 'stop',
            targetPosition: null,
          }),
        }),
      );
    });
  });
});

