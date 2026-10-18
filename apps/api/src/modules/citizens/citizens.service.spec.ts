import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CitizensService } from './citizens.service';
import type { AgentIdentityRepository, ExperienceRepository } from '@cidade-virtual/persistence';
import type { WorldGateway } from '../../gateways/world.gateway';

describe('CitizensService (Unit Test — Task-002)', () => {
  let service: CitizensService;
  let mockAgentRepo: {
    upsert: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    listAll: ReturnType<typeof vi.fn>;
    updateEmotion: ReturnType<typeof vi.fn>;
  };
  let mockExpRepo: {
    record: ReturnType<typeof vi.fn>;
  };
  let mockGateway: {
    broadcastDomainEvent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAgentRepo = {
      upsert: vi.fn(),
      getById: vi.fn(),
      listAll: vi.fn(),
      updateEmotion: vi.fn(),
    };
    mockExpRepo = {
      record: vi.fn(),
    };
    mockGateway = {
      broadcastDomainEvent: vi.fn(),
    };

    service = new CitizensService(
      mockAgentRepo as unknown as AgentIdentityRepository,
      mockExpRepo as unknown as ExperienceRepository,
      mockGateway as unknown as WorldGateway
    );
  });

  it('deve gerar UUID v4 real e persistir novo habitante no repositório relacional', async () => {
    mockAgentRepo.upsert.mockImplementation(async (data) => data);

    const result = await service.create({
      name: 'Vega',
      archetype: 'citizen',
      initialPosition: { lat: 10, lng: -20, altitude: 0 },
      initialEmotion: 'curious',
      backstorySeed: 'Engenheira de dados explorando a cidade',
    });

    expect(result.id).toBeDefined();
    // Verifica formato UUID v4
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(result.name).toBe('Vega');
    expect(result.archetype).toBe('citizen');

    expect(mockAgentRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        name: 'Vega',
        archetype: 'citizen',
        emotionState: 'curious',
      })
    );
  });

  it('deve atualizar emoção via repositório e emitir evento via gateway', async () => {
    mockAgentRepo.updateEmotion.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      emotionState: 'joyful',
    });

    await service.setEmotion('00000000-0000-0000-0000-000000000001', 'joyful', 0.8, 45);

    expect(mockAgentRepo.updateEmotion).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'joyful'
    );
    expect(mockGateway.broadcastDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'citizen.emotion.changed',
      })
    );
  });

  it('deve emitir broadcastAlert e gravar experiência ambiental para os habitantes notificados', async () => {
    const citizenId = '00000000-0000-0000-0000-000000000001';
    mockExpRepo.record.mockResolvedValue({ id: 'exp-1' });

    const result = await service.broadcastAlert({
      message: 'Sirene de emergência na Avenida Central!',
      severity: 'warning',
      citizenIds: [citizenId],
    });

    expect(result).toEqual([citizenId]);
    expect(mockGateway.broadcastDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'npc.alert',
      })
    );
    expect(mockExpRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: citizenId,
        eventType: 'npc_broadcast_alert',
        description: 'Sirene de emergência na Avenida Central!',
        sourceType: 'environment',
      })
    );
  });
});
