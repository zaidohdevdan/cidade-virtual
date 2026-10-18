import { Injectable, Logger, Optional } from '@nestjs/common';
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
import {
  AgentIdentityRepository,
  ExperienceRepository,
} from '@cidade-virtual/persistence';
import { WorldGateway } from '../../gateways/world.gateway';

@Injectable()
export class CitizensService {
  private readonly logger = new Logger(CitizensService.name);

  constructor(
    private readonly agentRepo: AgentIdentityRepository,
    private readonly expRepo: ExperienceRepository,
    @Optional() private readonly worldGateway?: WorldGateway,
  ) {}

  /**
   * Cria um novo cidadão na cidade virtual com identidade persistida no PostgreSQL.
   */
  async create(input: CreateCitizenInput): Promise<{ id: CitizenId; name: string; archetype: CitizenArchetype }> {
    const id = crypto.randomUUID() as CitizenId;

    await this.agentRepo.upsert({
      id,
      name: input.name,
      archetype: input.archetype,
      profileData: {
        backstorySeed: input.backstorySeed ?? '',
      },
      activeGoals: [],
      preferences: {},
      currentLocation: {
        x: input.initialPosition.lat,
        y: input.initialPosition.altitude ?? 0,
        z: input.initialPosition.lng,
      },
      emotionState: input.initialEmotion ?? 'calm',
    });

    this.logger.log(`[AUDIT] Habitante persistente criado: ${input.name} (${id}) arquétipo: ${input.archetype}`);

    return {
      id,
      name: input.name,
      archetype: input.archetype,
    };
  }

  /**
   * Obtém os dados de um habitante pelo ID.
   */
  async getById(citizenId: string) {
    return this.agentRepo.getById(citizenId);
  }

  /**
   * Lista todos os habitantes persistidos.
   */
  async listAll() {
    return this.agentRepo.listAll();
  }

  /**
   * Define o estado emocional de um habitante e registra em auditoria.
   */
  async setEmotion(
    citizenId: string,
    emotion: EmotionState,
    intensity: number = 0.5,
    durationMinutes: number = 60
  ): Promise<void> {
    const updated = await this.agentRepo.updateEmotion(citizenId, emotion);
    if (!updated) {
      this.logger.warn(`Habitante não encontrado para atualização de emoção: ${citizenId}`);
      return;
    }

    this.logger.log(
      `[AUDIT] Emoção de ${citizenId} alterada para '${emotion}' (intensidade: ${intensity}, duração: ${durationMinutes}m)`
    );

    this.worldGateway?.broadcastDomainEvent({
      name: 'citizen.emotion.changed',
      payload: { citizenId, emotion, intensity, durationMinutes },
    });
  }

  /**
   * Solicita revisão humana explícita a Daniel.
   */
  async requestReview(input: RequestHumanReviewInput): Promise<{ id: TicketId; status: 'pending' }> {
    const ticketId = crypto.randomUUID() as TicketId;

    this.logger.warn(
      `[AUDIT-HUMAN-REVIEW] Ticket ${ticketId} [Prioridade: ${input.priority}]: ${input.summary}`
    );

    this.worldGateway?.broadcastDomainEvent({
      name: 'human.review.requested',
      payload: { ticketId, ...input },
    });

    return {
      id: ticketId,
      status: 'pending',
    };
  }

  /**
   * Dispara broadcast curto para os NPCs do cenário e registra a experiência ambiental.
   */
  async broadcastAlert(input: NpcBroadcastAlertInput): Promise<string[]> {
    this.logger.log(`[AUDIT] Broadcast enviado: "${input.message}" (severidade: ${input.severity})`);

    this.worldGateway?.broadcastDomainEvent({
      name: 'npc.alert',
      payload: input,
    });

    const targetCitizens = input.citizenIds && input.citizenIds.length > 0 ? input.citizenIds : [];

    for (const citizenId of targetCitizens) {
      try {
        await this.expRepo.record({
          agentId: citizenId,
          eventType: 'npc_broadcast_alert',
          description: input.message,
          sourceType: 'environment',
          confidence: '1.00',
          importance: input.severity === 'critical' ? '0.95' : input.severity === 'warning' ? '0.75' : '0.50',
          relatedEntityIds: input.scenarioId ? [input.scenarioId] : [],
          metadata: { severity: input.severity, broadcast: true },
        });
      } catch (err) {
        this.logger.warn(`Falha ao registrar experiência de alerta para ${citizenId}: ${err}`);
      }
    }

    return targetCitizens;
  }
}
