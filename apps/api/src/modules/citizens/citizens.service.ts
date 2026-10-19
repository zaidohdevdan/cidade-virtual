import { Injectable, Logger, Optional, OnModuleInit, Inject } from '@nestjs/common';
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
import { MemoryService } from '../memory/memory.service';
import { SEED_CITIZENS, SeedCitizenConfig } from './citizens.seed';

@Injectable()
export class CitizensService implements OnModuleInit {
  private readonly logger = new Logger(CitizensService.name);

  constructor(
    @Inject(AgentIdentityRepository) private readonly agentRepo: AgentIdentityRepository,
    @Inject(ExperienceRepository) private readonly expRepo: ExperienceRepository,
    @Optional() @Inject(WorldGateway) private readonly worldGateway?: WorldGateway,
    @Optional() @Inject(MemoryService) private readonly memoryService?: MemoryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultCitizens();
  }

  /**
   * Popula idempotentemente os 5 habitantes canônicos (Task-013) com arquétipos variados,
   * posições urbanas, objetivos e memórias episódicas iniciais persistidas no PostgreSQL e Qdrant.
   */
  async seedDefaultCitizens(): Promise<{ seededCount: number; experiencesCount: number }> {
    if (!this.agentRepo || !this.expRepo) {
      this.logger.warn('Repositórios relacionais não injetados. Seed ignorado (modo offline/resiliente).');
      return { seededCount: 0, experiencesCount: 0 };
    }

    this.logger.log('Iniciando seed de habitantes canônicos e fase meta de consciência...');
    let seededCount = 0;
    let experiencesCount = 0;

    if (this.memoryService) {
      try {
        await this.memoryService.ensureCollection();
      } catch (err) {
        this.logger.warn(`Não foi possível inicializar a coleção no Qdrant: ${err}`);
      }
    }

    for (const citizenConfig of SEED_CITIZENS) {
      try {
        // 1. Upsert da identidade no PostgreSQL
        await this.agentRepo.upsert({
          id: citizenConfig.id,
          name: citizenConfig.name,
          archetype: citizenConfig.archetype,
          profileData: {
            starDesignation: citizenConfig.starDesignation,
            role: citizenConfig.role,
            backstorySeed: citizenConfig.backstorySeed,
          },
          activeGoals: citizenConfig.activeGoals,
          preferences: {},
          currentLocation: citizenConfig.initialPosition,
          emotionState: citizenConfig.initialEmotion,
        });
        seededCount++;

        // 2. Persistência de Experiências Episódicas Iniciais (Idempotente)
        const existingExperiences = await this.expRepo.getByAgentId(citizenConfig.id, 100);
        const existingDescriptions = new Set(existingExperiences.map((e) => e.description));

        for (const exp of citizenConfig.initialExperiences) {
          if (!existingDescriptions.has(exp.description)) {
            // Grava no PostgreSQL
            await this.expRepo.record({
              agentId: citizenConfig.id,
              eventType: exp.eventType,
              description: exp.description,
              locationId: exp.locationId,
              sourceType: exp.sourceType,
              confidence: exp.confidence,
              importance: exp.importance,
              relatedEntityIds: exp.locationId ? [exp.locationId] : [],
              metadata: { canonicalSeed: true, starDesignation: citizenConfig.starDesignation },
            });
            experiencesCount++;

            // Indexa semanticamente no Qdrant (Memória Episódica)
            if (this.memoryService) {
              try {
                await this.memoryService.addMemory({
                  citizenId: citizenConfig.id as CitizenId,
                  content: exp.description,
                  timestamp: new Date(),
                  sensoryTags: ['visual', 'social'],
                  emotionalWeight: parseFloat(exp.importance),
                  origin: 'observation',
                  memoryType: 'episodic',
                  sourceType: exp.sourceType,
                  confidence: parseFloat(exp.confidence),
                });
              } catch (qdrantErr) {
                this.logger.warn(
                  `Falha ao indexar memória episódica no Qdrant para ${citizenConfig.id}: ${qdrantErr}`
                );
              }
            }
          }
        }
      } catch (err) {
        this.logger.error(`Erro ao semear habitante ${citizenConfig.name} (${citizenConfig.id}): ${err}`);
      }
    }

    this.logger.log(
      `Seed de habitantes concluído: ${seededCount} identidades verificadas/sincronizadas, ${experiencesCount} novas experiências registradas.`
    );

    return { seededCount, experiencesCount };
  }

  /**
   * Obtém as experiências registradas de um habitante.
   */
  async getCitizenExperiences(citizenId: string, limit: number = 50) {
    return this.expRepo.getByAgentId(citizenId, limit);
  }

  /**
   * Consulta memórias episódicas indexadas semanticamente no Qdrant.
   */
  async getCitizenMemories(
    citizenId: string,
    query: string = 'observação regras convivência',
    limit: number = 10
  ) {
    if (!this.memoryService) return [];
    return this.memoryService.semanticQuery({
      citizenId: citizenId as CitizenId,
      queryText: query,
      topK: limit,
    });
  }

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
