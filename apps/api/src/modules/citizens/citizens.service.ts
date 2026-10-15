import { Injectable } from '@nestjs/common';
import type {
  CitizenId,
  CitizenArchetype,
  EmotionState,
  TicketId,
} from '@cidade-virtual/types';
import type {
  CreateCitizenInput,
  RequestHumanReviewInput,
  NpcBroadcastAlertInput,
} from '@cidade-virtual/tools/schemas';

@Injectable()
export class CitizensService {
  /**
   * Cria um novo cidadão na cidade virtual.
   */
  async create(input: CreateCitizenInput): Promise<{ id: CitizenId; name: string; archetype: CitizenArchetype }> {
    // TODO: persistir no banco relacional / documento e gerar ID
    return {
      id: '00000000-0000-0000-0000-000000000001' as CitizenId,
      name: input.name,
      archetype: input.archetype,
    };
  }

  /**
   * Define forçadamente o estado emocional de um habitante.
   */
  async setEmotion(
    _citizenId: string,
    _emotion: EmotionState,
    _intensity: number,
    _durationMinutes: number
  ): Promise<void> {
    // TODO: atualizar estado emocional e registrar log de auditoria
  }

  /**
   * Solicita revisão humana explícita a Daniel.
   */
  async requestReview(_input: RequestHumanReviewInput): Promise<{ id: TicketId; status: 'pending' }> {
    // TODO: persistir o ticket no banco e notificar painel administrativo
    return {
      id: '00000000-0000-0000-0000-000000000002' as TicketId,
      status: 'pending',
    };
  }

  /**
   * Dispara broadcast curto para os NPCs do cenário.
   */
  async broadcastAlert(input: NpcBroadcastAlertInput): Promise<string[]> {
    // TODO: despachar broadcast via WebSocket e registrar entregas
    return input.citizenIds ?? [];
  }
}
