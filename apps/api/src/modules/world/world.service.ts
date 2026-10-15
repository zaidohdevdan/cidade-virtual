// apps/api/src/modules/world/world.service.ts
import { Injectable } from '@nestjs/common';
import type {
  EventLog,
  EventId,
  GeoCoords,
  SceneSnapshot,
} from '@cidade-virtual/types';
import type { TriggerEventInput } from '@cidade-virtual/tools/schemas';

/**
 * Serviço do mundo — administra cenários, clima e estado do ambiente.
 * Alinhado com packages/world-engine (Seção 3.1 SKILL 2.0.0).
 */
@Injectable()
export class WorldService {
  /**
   * Injeta um evento dramático no cenário.
   */
  async triggerEvent(input: TriggerEventInput): Promise<EventLog> {
    // TODO: propagar evento no cenário e calcular cidadãos impactados
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
   * Define condição climática do cenário.
   */
  async setWeather(
    _scenarioId: string,
    _condition: 'clear' | 'rain' | 'storm' | 'fog' | 'snow',
    _durationMinutes: number,
    _intensity: number
  ): Promise<void> {
    // TODO: atualizar clima no estado da cena e notificar clientes 3D via socket
  }

  /**
   * Recupera snapshot completo da cena.
   */
  async getSnapshot(scenarioId: string, _includeMemories: boolean): Promise<SceneSnapshot> {
    // TODO: recuperar posições de NPCs, objetos, clima e hora do cenário
    return {
      scenarioId,
      citizens: [],
      objects: [],
      weather: 'clear',
      timeOfDay: 12,
    };
  }
}
