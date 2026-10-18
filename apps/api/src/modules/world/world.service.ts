// apps/api/src/modules/world/world.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import type {
  EventLog,
  EventId,
  GeoCoords,
  SceneSnapshot,
} from '@cidade-virtual/types';
import type { TriggerEventInput } from '@cidade-virtual/tools/schemas';
import { WorldStateRepository, WorldStateRow } from '@cidade-virtual/persistence';

export const VALID_WEATHER_CONDITIONS = ['clear', 'rain', 'storm', 'fog', 'snow'] as const;
export type WeatherCondition = (typeof VALID_WEATHER_CONDITIONS)[number];

function toWeatherCondition(value: string | undefined | null): WeatherCondition {
  if (value && (VALID_WEATHER_CONDITIONS as readonly string[]).includes(value)) {
    return value as WeatherCondition;
  }
  return 'clear';
}

/**
 * Serviço do mundo — administra cenários, clima, tick temporal e estado autoritativo.
 * Alinhado com packages/world-engine e SKILL 2.0.0 (Seções 3.1 e 13.1 - Fase 1).
 */
@Injectable()
export class WorldService implements OnModuleInit {
  private readonly logger = new Logger(WorldService.name);
  public static readonly DEFAULT_WORLD_ID = 'rua-central-main';

  constructor(private readonly worldStateRepo: WorldStateRepository) {}

  async onModuleInit() {
    try {
      let state = await this.worldStateRepo.getById(WorldService.DEFAULT_WORLD_ID);
      if (!state) {
        state = await this.worldStateRepo.upsert({
          id: WorldService.DEFAULT_WORLD_ID,
          name: 'Rua Central — Distrito Central',
          tickCount: 0,
          timeOfDay: 12,
          weather: 'clear',
        });
        this.logger.log(`Estado inicial do mundo inicializado: ${state.id} (tick: ${state.tickCount})`);
      } else {
        this.logger.log(`Estado persistente do mundo recuperado: ${state.id} (tick: ${state.tickCount})`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Banco relacional não acessível no bootstrap (modo offline/resiliente): ${message}`);
    }
  }

  /**
   * Obtém o estado autoritativo persistente do mundo.
   */
  async getWorldState(id: string = WorldService.DEFAULT_WORLD_ID): Promise<WorldStateRow | null> {
    try {
      return await this.worldStateRepo.getById(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Erro ao consultar estado do mundo: ${message}`);
      return null;
    }
  }

  /**
   * Avança os ticks de simulação e persiste o progresso.
   */
  async incrementTick(id: string = WorldService.DEFAULT_WORLD_ID, amount: number = 1): Promise<WorldStateRow | null> {
    return this.worldStateRepo.incrementTick(id, amount);
  }

  /**
   * Injeta um evento dramático no cenário.
   */
  async triggerEvent(input: TriggerEventInput): Promise<EventLog> {
    return {
      id: '00000000-0000-0000-0000-000000000003' as EventId,
      type: input.type,
      location: input.location as GeoCoords,
      timestamp: new Date(),
      affectedCitizens: [],
      description: input.description,
    };
  }

  /**
   * Define condição climática do cenário e persiste no banco, preservando o horário atual do mundo.
   */
  async setWeather(
    scenarioId: string = WorldService.DEFAULT_WORLD_ID,
    condition: WeatherCondition,
    _durationMinutes: number = 30,
    _intensity: number = 1.0,
    timeOfDay?: number
  ): Promise<void> {
    const currentState = await this.getWorldState(scenarioId);
    const targetTime = timeOfDay ?? currentState?.timeOfDay ?? 12;
    await this.worldStateRepo.updateEnvironment(scenarioId, targetTime, condition);
    this.logger.log(`Clima do cenário ${scenarioId} alterado para ${condition} (hora: ${targetTime}h)`);
  }

  /**
   * Retorna um snapshot estático do cenário.
   */
  async getSnapshot(
    _scenarioId: string = WorldService.DEFAULT_WORLD_ID,
    _includeMemories?: boolean
  ): Promise<SceneSnapshot> {
    const state = await this.getWorldState(_scenarioId);
    return {
      scenarioId: state?.id || WorldService.DEFAULT_WORLD_ID,
      citizens: [],
      objects: [],
      weather: toWeatherCondition(state?.weather),
      timeOfDay: state?.timeOfDay ?? 12,
    };
  }
}
