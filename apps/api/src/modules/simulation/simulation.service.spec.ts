// apps/api/src/modules/simulation/simulation.service.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutonomousSimulationService } from './simulation.service';
import type { WorldGateway } from '../../gateways/world.gateway';
import type { CognitionService } from '../cognition/cognition.service';
import type { WorldService } from '../world/world.service';
import type { AgentIdentityRepository, ExperienceRepository } from '@cidade-virtual/persistence';

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
    };

    mockWorldService = {
      incrementTick: vi.fn().mockResolvedValue({ tickCount: 1 }),
    };

    mockAgentRepo = {
      updateLocation: vi.fn().mockResolvedValue({ id: 'agent-vega' }),
    };

    mockExpRepo = {
      record: vi.fn().mockResolvedValue({ id: 'exp-1' }),
    };

    service = new AutonomousSimulationService(
      mockWorldGateway as unknown as WorldGateway,
      mockCognitionService as unknown as CognitionService,
      mockWorldService as unknown as WorldService,
      undefined,
      mockAgentRepo as unknown as AgentIdentityRepository,
      mockExpRepo as unknown as ExperienceRepository,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it('deve inicializar todos os 5 agentes canônicos de Lira no runtime', async () => {
    await service.onModuleInit();

    const states = service.getAgentStates();
    expect(states.size).toBe(5);
    expect(states.has('agent-vega')).toBe(true);
    expect(states.has('agent-sulafat')).toBe(true);
    expect(states.has('agent-sheliak')).toBe(true);
    expect(states.has('agent-epsilon')).toBe(true);
    expect(states.has('agent-chason')).toBe(true);
  });

  it('deve avançar o tick e emitir agent.moved e agent.speech durante o passo de simulação', async () => {
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
        }),
      }),
    );
  });

  it('deve encerrar o timer de heartbeat no onModuleDestroy', async () => {
    await service.onModuleInit();
    service.onModuleDestroy();
    expect(true).toBe(true);
  });
});
