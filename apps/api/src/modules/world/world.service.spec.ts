import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldService } from './world.service';
import type { WorldStateRepository } from '@cidade-virtual/persistence';

describe('WorldService (Unit Test — Task-010)', () => {
  let worldService: WorldService;
  let mockWorldStateRepo: {
    getById: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    incrementTick: ReturnType<typeof vi.fn>;
    updateEnvironment: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockWorldStateRepo = {
      getById: vi.fn(),
      upsert: vi.fn(),
      incrementTick: vi.fn(),
      updateEnvironment: vi.fn(),
    };

    worldService = new WorldService(mockWorldStateRepo as unknown as WorldStateRepository);
  });

  it('deve preservar o timeOfDay atual ao alterar o clima se nenhum novo horário for informado', async () => {
    // Simula que o mundo está atualmente às 19h (noite)
    mockWorldStateRepo.getById.mockResolvedValue({
      id: WorldService.DEFAULT_WORLD_ID,
      name: 'Rua Central — Distrito Central',
      tickCount: 150,
      timeOfDay: 19,
      weather: 'clear',
    });

    mockWorldStateRepo.updateEnvironment.mockResolvedValue({
      id: WorldService.DEFAULT_WORLD_ID,
      name: 'Rua Central — Distrito Central',
      tickCount: 150,
      timeOfDay: 19,
      weather: 'rain',
    });

    await worldService.setWeather(WorldService.DEFAULT_WORLD_ID, 'rain');

    // Verifica que updateEnvironment foi chamado com 19h, e NÃO com 12h hardcoded
    expect(mockWorldStateRepo.getById).toHaveBeenCalledWith(WorldService.DEFAULT_WORLD_ID);
    expect(mockWorldStateRepo.updateEnvironment).toHaveBeenCalledWith(
      WorldService.DEFAULT_WORLD_ID,
      19,
      'rain'
    );
  });

  it('deve permitir alterar o timeOfDay explicitamente junto com o clima', async () => {
    mockWorldStateRepo.getById.mockResolvedValue({
      id: WorldService.DEFAULT_WORLD_ID,
      timeOfDay: 14,
      weather: 'clear',
    });

    await worldService.setWeather(
      WorldService.DEFAULT_WORLD_ID,
      'storm',
      30,
      1.0,
      22 // Força 22h
    );

    expect(mockWorldStateRepo.updateEnvironment).toHaveBeenCalledWith(
      WorldService.DEFAULT_WORLD_ID,
      22,
      'storm'
    );
  });

  it('deve usar fallback 12h se o estado atual não existir no banco', async () => {
    mockWorldStateRepo.getById.mockResolvedValue(null);

    await worldService.setWeather('unregistered-scenario', 'fog');

    expect(mockWorldStateRepo.updateEnvironment).toHaveBeenCalledWith(
      'unregistered-scenario',
      12,
      'fog'
    );
  });
});
