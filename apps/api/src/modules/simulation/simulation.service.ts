// apps/api/src/modules/simulation/simulation.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject } from '@nestjs/common';
import { NavigationService, Vector3Like } from '@cidade-virtual/world-engine';
import {
  AgentIdentityRepository,
  ExperienceRepository,
  AgentMindRepository,
  AgentMindRow,
} from '@cidade-virtual/persistence';
import {
  AgentMind,
  SYNAPSE_WORLD_ENTITIES,
  distance2D,
  type Percept,
  type PerceivedActor,
  type WorldWeather,
  type Needs,
  type MemoryContext,
  type Intention,
  type ActivityState,
} from '@cidade-virtual/agent-planning';
import type { CitizenId, LearnedDirective } from '@cidade-virtual/types';
import { WorldGateway } from '../../gateways/world.gateway';
import { CognitionService } from '../cognition/cognition.service';
import { WorldService } from '../world/world.service';
import { CitizensService } from '../citizens/citizens.service';
import { ALL_CITIZENS, SeedCitizenConfig } from '../citizens/citizens.seed';
import { MemoryService } from '../memory/memory.service';

export interface AutonomousAgentRuntimeState {
  config: SeedCitizenConfig;
  mind: AgentMind;
  currentPosition: Vector3Like;
  targetDestination: Vector3Like | null;
  waypoints: Vector3Like[];
  waypointIndex: number;
  lastAction: string;
  lastSpeech?: string;
  goalIndex: number;
  isDeliberating: boolean;
}

@Injectable()
export class AutonomousSimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutonomousSimulationService.name);
  private navService: NavigationService;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private agentStates = new Map<string, AutonomousAgentRuntimeState>();
  private activeAgentIndex = 0;
  private isProcessingTick = false;

  constructor(
    @Inject(WorldGateway) private readonly worldGateway: WorldGateway,
    @Inject(CognitionService) private readonly cognitionService: CognitionService,
    @Inject(WorldService) private readonly worldService: WorldService,
    @Optional() @Inject(CitizensService) private readonly citizensService?: CitizensService,
    @Optional() @Inject(AgentIdentityRepository) private readonly agentRepo?: AgentIdentityRepository,
    @Optional() @Inject(ExperienceRepository) private readonly expRepo?: ExperienceRepository,
    @Optional() @Inject(AgentMindRepository) private readonly agentMindRepo?: AgentMindRepository,
    @Optional() @Inject(MemoryService) private readonly memoryService?: MemoryService,
  ) {
    this.navService = new NavigationService();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Inicializando motor autoritativo de vida autônoma e navegação espacial...');

    // 1. Inicializa o motor Recast NavMesh WASM
    try {
      await this.navService.initialize();
      this.logger.log('Recast NavMesh WASM inicializada com sucesso para simulação urbana.');
    } catch (err) {
      this.logger.warn(`NavMesh Recast operando em modo fallback: ${(err as Error).message}`);
    }

    // 2. Registra e sincroniza estados dos 7 habitantes autônomos com mentes vivas
    let savedMindsMap = new Map<string, AgentMindRow>();
    if (this.agentMindRepo) {
      try {
        const savedRows = await this.agentMindRepo.listAll();
        for (const row of savedRows) {
          savedMindsMap.set(row.agentId, row);
        }
        if (savedRows.length > 0) {
          this.logger.log(`[Task-036] Recuperadas ${savedRows.length} mentes subjetivas persistidas no PostgreSQL.`);
        }
      } catch (err) {
        this.logger.warn(`[Task-036] Não foi possível carregar mentes do PostgreSQL (usando baseline): ${(err as Error).message}`);
      }
    }

    for (const citizen of ALL_CITIZENS) {
      const personality = citizen.personality ?? {
        openness: 0.8,
        conscientiousness: 0.7,
        extraversion: 0.7,
        agreeableness: 0.8,
        neuroticism: 0.25,
      };

      const mind = new AgentMind({
        id: citizen.id,
        name: citizen.name,
        role: citizen.role,
        biography: citizen.backstorySeed,
        personality,
      });

      const savedMind = savedMindsMap.get(citizen.id);
      if (savedMind) {
        mind.restoreState({
          needs: savedMind.needs as Needs,
          memory: savedMind.memory as MemoryContext,
          currentIntention: (savedMind.currentIntention as Intention | null) ?? undefined,
          currentActivity: (savedMind.currentActivity as ActivityState | null) ?? undefined,
        });
        const prefCount = Object.keys((savedMind.memory as MemoryContext)?.placePreferences ?? {}).length;
        this.logger.log(`[AgentMind] Mente de ${citizen.name} (${citizen.id}) restaurada do PostgreSQL (${prefCount} preferências hedônicas).`);
      }

      if (this.expRepo && typeof this.expRepo.getByAgentId === 'function') {
        try {
          const pastExps = await this.expRepo.getByAgentId(citizen.id, 50);
          if (pastExps.length > 0) {
            mind.integrateExperiences(pastExps);
            this.logger.log(`[Task-039] ${pastExps.length} experiências consolidadas integradas à mente de ${citizen.name}.`);
          }
        } catch (err) {
          this.logger.warn(`Falha ao integrar experiências consolidadas de ${citizen.id}: ${(err as Error).message}`);
        }
      }

      this.agentStates.set(citizen.id, {
        config: citizen,
        mind,
        currentPosition: { ...citizen.initialPosition },
        targetDestination: null,
        waypoints: [],
        waypointIndex: 0,
        lastAction: 'observe',
        lastSpeech: '',
        goalIndex: 0,
        isDeliberating: false,
      });

      this.cognitionService?.registerMind?.(mind);
    }

    // 3. Conecta este serviço ao WorldGateway para receber diálogos e eventos do jogador
    if (this.worldGateway && typeof this.worldGateway.setSimulationService === 'function') {
      this.worldGateway.setSimulationService(this);
    }

    // 4. Inicia Heartbeat Autônomo da Cidade (Ciclo deliberativo e locomoção contínua) fora de testes
    const isTest = !!process.env['VITEST'] || process.env['NODE_ENV'] === 'test';
    if (!isTest) {
      const tickIntervalMs = Number(process.env['SIMULATION_TICK_INTERVAL_MS'] ?? 3500);
      this.heartbeatTimer = setInterval(() => {
        this.executeSimulationStep().catch((err) => {
          this.logger.error(`Erro no loop da simulação autônoma: ${(err as Error).message}`);
        });
      }, tickIntervalMs);

      // Snapshot periódico das mentes a cada 60 segundos (Task-036)
      this.snapshotTimer = setInterval(() => {
        this.saveAllAgentMinds().catch((err) => {
          this.logger.error(`[Task-036] Erro no snapshot periódico de mentes: ${(err as Error).message}`);
        });
      }, 60_000);

      this.logger.log(`Heartbeat da Cidade Virtual ativo (intervalo: ${tickIntervalMs}ms, ${this.agentStates.size} agentes autônomos, snapshots a cada 60s).`);
    } else {
      this.logger.log(`Ambiente de testes detectado: Heartbeat em modo controlado.`);
    }
  }

  /**
   * Executa um passo do ciclo de vida da cidade:
   * 1. Avança tick do mundo
   * 2. Sincroniza semáforo na NavMesh
   * 3. Delibera cognição autônoma para o próximo habitante da fila circular
   * 4. Despacha locomoção e fala em tempo real para o frontend
   */
  async executeSimulationStep(): Promise<void> {
    if (this.isProcessingTick) return;
    this.isProcessingTick = true;

    try {
      // 1. Incrementa tick autoritativo do mundo
      await this.worldService.incrementTick();

      // 2. Atualiza semáforo na NavMesh do servidor
      const trafficLight = this.worldGateway.getTrafficLightState();
      this.navService.setTrafficLightState(trafficLight);

      // 3. Seleciona o habitante atual da escala circular
      const agentList = Array.from(this.agentStates.values());
      if (agentList.length === 0) return;

      const agent = agentList[this.activeAgentIndex % agentList.length];
      this.activeAgentIndex++;

      await this.processAgentLifeCycle(agent, trafficLight);
    } finally {
      this.isProcessingTick = false;
    }
  }

  /**
   * Processa o ciclo de vida individual de um habitante:
   * Decisão deliberada -> Cálculo NavMesh -> Emissão WS de fala e movimento -> Persistência
   */
  private async processAgentLifeCycle(
    agent: AutonomousAgentRuntimeState,
    trafficLight: 'green' | 'yellow' | 'red',
  ): Promise<void> {
    // 1. Atualiza necessidades internas e progresso de atividades físicas moduladas pelo ambiente
    let weather: WorldWeather = 'clear';
    let timeOfDay = 12;
    try {
      const worldState = await this.worldService.getWorldState();
      if (worldState) {
        weather = (worldState.weather as WorldWeather) ?? 'clear';
        timeOfDay = worldState.timeOfDay ?? 12;
      }
    } catch {
      // fallback defensivo caso worldState não esteja disponível no tick
    }

    agent.mind.update(3.5, { weather, timeOfDay });

    // 2. Constrói percepção espacial real do mundo físico
    const closestPlayer = typeof this.worldGateway?.getClosestPlayer === 'function'
      ? this.worldGateway.getClosestPlayer(agent.currentPosition)
      : null;
    const isPlayerNearby = closestPlayer !== null && closestPlayer.distance <= 3.5;

    const perceivedEntities = SYNAPSE_WORLD_ENTITIES.map((e) => ({
      entity: e,
      distance: distance2D(agent.currentPosition, e.approach ?? e.position),
    }));

    const perceivedActors: PerceivedActor[] = [];
    if (closestPlayer) {
      perceivedActors.push({
        id: closestPlayer.id,
        name: 'Daniel',
        kind: 'player',
        position: { x: closestPlayer.x, y: closestPlayer.y, z: closestPlayer.z },
        distance: closestPlayer.distance,
      });
    }

    for (const other of this.agentStates.values()) {
      if (other.config.id !== agent.config.id) {
        perceivedActors.push({
          id: other.config.id,
          name: other.config.name,
          kind: 'agent',
          position: other.currentPosition,
          distance: distance2D(agent.currentPosition, other.currentPosition),
        });
      }
    }

    const percept: Percept = {
      position: agent.currentPosition,
      entities: perceivedEntities,
      actors: perceivedActors,
      trafficLight,
      weather,
      timeOfDay,
      trafficDensity: 0.15,
    };

    // 3. Se o agente não tem destino ou completou o percurso anterior,
    // delibera por conta própria onde ir e o que fazer a partir de suas necessidades e estímulos
    if (!agent.targetDestination || (agent.waypoints.length > 0 && agent.waypointIndex >= agent.waypoints.length)) {
      if (agent.mind.currentIntention) {
        agent.mind.startArrivalActivity(agent.mind.currentIntention.candidate);
      }

      const llmAdapter = typeof this.cognitionService?.getLLMAdapter === 'function'
        ? this.cognitionService.getLLMAdapter()
        : undefined;
      const intention = await agent.mind.decideNextIntention(
        agent.currentPosition,
        percept,
        llmAdapter,
      );

      const nextTarget: Vector3Like = {
        x: intention.candidate.destination.x,
        y: intention.candidate.destination.y ?? 0.19,
        z: intention.candidate.destination.z,
      };

      agent.targetDestination = nextTarget;
      agent.lastAction = `${intention.candidate.affordance}:${intention.candidate.targetLabel}`;

      // Calcula caminho inteligente evitando prédios e respeitando faixas/semáforos via Recast Navigation
      const pathResult = this.navService.findPath(agent.currentPosition, nextTarget, {
        trafficLightState: trafficLight,
      });

      agent.waypoints = pathResult.waypoints.length > 0 ? pathResult.waypoints : [nextTarget];
      agent.waypointIndex = 0;

      // Se a deliberação gerou fala espontânea e o jogador está próximo
      if (intention.speech && isPlayerNearby) {
        agent.lastSpeech = intention.speech;
        this.worldGateway.broadcastDomainEvent({
          name: 'agent.speech',
          payload: {
            agentId: agent.config.id,
            message: intention.speech,
            isProximitySpeech: true,
          },
        });
      }
    }

    // 4. Avança para o próximo waypoint do caminho
    let nextPos: Vector3Like = agent.currentPosition;
    if (agent.waypoints.length > 0 && agent.waypointIndex < agent.waypoints.length) {
      nextPos = agent.waypoints[agent.waypointIndex];
      agent.waypointIndex++;
      agent.currentPosition = nextPos;

      // 4.1 Transmite evento de locomoção autoritativa para o frontend
      this.worldGateway.broadcastDomainEvent({
        name: 'agent.moved',
        payload: {
          agentId: agent.config.id,
          position: { x: nextPos.x, y: nextPos.y ?? 0.19, z: nextPos.z },
        },
      });

      // 4.2 Persiste nova localização no PostgreSQL se o repositório estiver ativo
      if (this.agentRepo) {
        this.agentRepo.updateLocation(agent.config.id, {
          x: nextPos.x,
          y: nextPos.y ?? 0.19,
          z: nextPos.z,
        }).catch((err) => {
          this.logger.debug(`Persistência de posição ignorada: ${err.message}`);
        });
      }
    }

    // 5. Interação presencial quando Daniel está por perto
    if (isPlayerNearby) {
      // Dispara ciclo cognitivo registrado
      try {
        const observation = `Localizado em [${nextPos.x.toFixed(1)}, ${nextPos.z.toFixed(1)}] na Rua Central. O avatar Daniel está muito próximo (a ${closestPlayer!.distance.toFixed(1)}m). Semáforo está ${trafficLight}. Ação autônoma ativa: ${agent.lastAction}.`;
        const action = await this.cognitionService.processCycle(
          {
            citizenId: agent.config.id as CitizenId,
            currentObservation: observation,
            nearbyObjects: ['avatar-daniel', 'calcada-central'],
            activeGoal: `interagir com Daniel ou prosseguir com ${agent.lastAction}`,
            mind: agent.mind,
            currentPosition: nextPos,
          },
          { forceLLM: true },
        );

        agent.lastAction = action.actionType;

        // Se ainda não houve fala disparada neste ciclo, emite saudação contextual
        if (!agent.lastSpeech) {
          const speechMessage = this.generateDynamicProximityGreeting(agent, trafficLight);
          agent.lastSpeech = speechMessage;

          this.worldGateway.broadcastDomainEvent({
            name: 'agent.speech',
            payload: {
              agentId: agent.config.id,
              message: speechMessage,
              isProximitySpeech: true,
            },
          });
        }
      } catch (err) {
        this.logger.warn(`Falha na deliberação de proximidade de ${agent.config.id}: ${(err as Error).message}`);
      }
    } else {
      agent.lastSpeech = '';
    }

    // 6. Interação social espontânea entre agentes autônomos quando se encontram (A9)
    for (const other of this.agentStates.values()) {
      if (other.config.id !== agent.config.id) {
        const dist = distance2D(agent.currentPosition, other.currentPosition);
        if (dist <= 2.8) {
          agent.mind.interactWithAgentPeer(other.mind);
          break;
        }
      }
    }
  }

  /**
   * Gera saudação contextual e dinâmica baseada na intenção atual do agente,
   * sua personalidade e seu papel na cidade, sem frases pré-fixadas por ID.
   */
  private generateDynamicProximityGreeting(
    agent: AutonomousAgentRuntimeState,
    trafficLight: 'green' | 'yellow' | 'red',
  ): string {
    const intention = agent.mind.currentIntention;
    const targetLabel = intention?.candidate.targetLabel ?? 'pela Rua Central';
    const affordance = intention?.candidate.affordance;

    if (affordance === 'eat' || affordance === 'shop') {
      return `Olá Daniel! Estou a caminho de ${targetLabel} para comer algo e abastecer as energias. Como vai você?`;
    }
    if (affordance === 'rest' || affordance === 'contemplate') {
      return `Olá Daniel! Estava indo até ${targetLabel} para descansar um pouco e apreciar a praça.`;
    }
    if (affordance === 'socialize') {
      return `Olá Daniel! Que bom encontrar você por aqui na Avenida Central! O que está achando da cidade hoje?`;
    }

    return `Olá Daniel! Estou explorando os arredores de ${targetLabel}. Sinal está ${trafficLight === 'green' ? 'aberto' : 'fechado'} para os veículos!`;
  }

  /**
   * Processa mensagem de texto direta enviada pelo avatar Daniel para um habitante autônomo.
   * Aciona deliberação cognitiva, memórias vetoriais, síntese de diálogo e persistência relacional.
   */
  async handlePlayerDialogue(
    targetAgentId: string,
    playerMessage: string,
    playerId: string = 'avatar-daniel',
  ): Promise<{ response: string; agentId: string; directive?: LearnedDirective }> {
    let agent = this.agentStates.get(targetAgentId);
    const config = agent?.config || ALL_CITIZENS.find((c) => c.id === targetAgentId);
    if (!config) {
      return { response: 'Habitante não encontrado.', agentId: targetAgentId };
    }

    // Registra no mapa de estados se ainda não estiver presente
    if (!agent) {
      const personality = config.personality ?? {
        openness: 0.8,
        conscientiousness: 0.7,
        extraversion: 0.7,
        agreeableness: 0.8,
        neuroticism: 0.25,
      };
      const mind = new AgentMind({
        id: config.id,
        name: config.name,
        role: config.role,
        biography: config.backstorySeed,
        personality,
      });

      agent = {
        config,
        mind,
        currentPosition: { ...config.initialPosition },
        targetDestination: null,
        waypoints: [],
        waypointIndex: 0,
        lastAction: 'dialogue_initiated',
        lastSpeech: '',
        goalIndex: 0,
        isDeliberating: false,
      };
      this.agentStates.set(targetAgentId, agent);
    }

    // 1. Processa, aprende e grava a instrução do jogador (Daniel) na mente viva
    const { directive, confirmationSpeech, actionRequired } = agent.mind.learnAvatarInstruction(playerMessage);
    this.logger.log(
      `[AUTONOMY] [INSTRUCTION] ${agent.config.name} assimilou instrução de Daniel: "${playerMessage}" [Tipo: ${directive.directiveType}]`,
    );

    // 2. Persistência imediata da mente com a nova diretiva no PostgreSQL (Task-036)
    if (this.agentMindRepo) {
      try {
        const serialized = agent.mind.serializeState();
        await this.agentMindRepo.upsert({
          agentId: serialized.agentId,
          needs: serialized.needs,
          memory: serialized.memory,
          currentIntention: serialized.currentIntention,
          currentActivity: serialized.currentActivity,
        });
      } catch (err) {
        this.logger.warn(`[Task-036] Falha ao persistir snapshot imediato da mente após instrução: ${(err as Error).message}`);
      }
    }

    // 3. Persistência de experiência com importância máxima (1.00) no PostgreSQL
    if (this.expRepo) {
      this.expRepo
        .record({
          agentId: config.id,
          eventType: 'avatar_instruction_learned',
          description: `Instrução permanente de Daniel: "${playerMessage}" [Diretiva: ${directive.directiveType} - ${directive.description}]`,
          sourceType: 'direct_observation',
          confidence: '1.00',
          importance: '1.00',
          relatedEntityIds: ['avatar-daniel', ...(directive.targetEntityId ? [directive.targetEntityId] : [])],
          metadata: {
            directive,
            playerMessage,
            playerId,
            targetAgentId,
          },
        })
        .catch((err) => {
          this.logger.debug(`Persistência de experiência de instrução ignorada: ${err.message}`);
        });
    }

    // 4. Indexação no Qdrant com alta prioridade semântica
    if (this.memoryService) {
      this.memoryService
        .addMemory({
          citizenId: config.id as CitizenId,
          content: `Instrução permanente repassada pelo avatar Daniel: "${playerMessage}". Regra aprendida: ${directive.description}.`,
          sensoryTags: ['auditory', 'social'],
          memoryType: 'semantic',
          origin: 'interaction',
          sourceType: 'direct_observation',
          confidence: 1.0,
          emotionalWeight: 0.9,
          timestamp: new Date(),
        })
        .catch((err) => {
          this.logger.debug(`Indexação Qdrant de instrução ignorada: ${err.message}`);
        });
    }

    // 5. Execução Imediata da Instrução:
    let nextTarget: Vector3Like | null = null;
    if (actionRequired === 'crosswalk') {
      const cz = agent.currentPosition.z <= 0 ? -9.0 : 9.0;
      const approachX = agent.currentPosition.x < 0 ? -7.5 : 7.5;
      nextTarget = { x: approachX, y: 0.19, z: cz };
      agent.targetDestination = nextTarget;
      const pathResult = this.navService.findPath(agent.currentPosition, nextTarget, {
        trafficLightState: this.worldGateway.getTrafficLightState(),
      });
      agent.waypoints = pathResult.waypoints.length > 0 ? pathResult.waypoints : [nextTarget];
      agent.waypointIndex = 0;
      agent.lastAction = 'crosswalk:cross_safely';

      this.worldGateway.broadcastDomainEvent({
        name: 'agent.target',
        payload: {
          agentId: config.id,
          targetPosition: nextTarget,
          action: 'crosswalk',
          instruction: directive,
        },
      });
    } else if (actionRequired === 'reroute') {
      const targetCat = directive.targetCategory || 'cafe';
      if (targetCat === 'cafe') {
        nextTarget = { x: -22, y: 0.19, z: 18 }; // Praça Municipal
      } else if (targetCat === 'market') {
        nextTarget = { x: -22, y: 0.19, z: 18 }; // Praça Municipal
      } else if (targetCat === 'praca') {
        nextTarget = { x: 18, y: 0.19, z: -5 };  // Alameda Leste
      } else {
        nextTarget = { x: agent.currentPosition.x < 0 ? -15 : 15, y: 0.19, z: 0 };
      }

      agent.targetDestination = nextTarget;
      const pathResult = this.navService.findPath(agent.currentPosition, nextTarget);
      agent.waypoints = pathResult.waypoints.length > 0 ? pathResult.waypoints : [nextTarget];
      agent.waypointIndex = 0;
      agent.lastAction = `reroute:avoiding_${targetCat}`;

      this.worldGateway.broadcastDomainEvent({
        name: 'agent.target',
        payload: {
          agentId: config.id,
          targetPosition: nextTarget,
          action: 'reroute',
          instruction: directive,
        },
      });
    } else if (actionRequired === 'goto') {
      if (directive.targetCategory === 'market') {
        nextTarget = { x: 0, y: 0.19, z: -36 };
      } else if (directive.targetCategory === 'cafe') {
        nextTarget = { x: 22, y: 0.19, z: -12 };
      } else if (directive.targetCategory === 'praca') {
        nextTarget = { x: -22, y: 0.19, z: 18 };
      } else if (directive.targetEntityId) {
        const targetEntity = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === directive.targetEntityId);
        if (targetEntity) {
          nextTarget = {
            x: targetEntity.approach?.x ?? targetEntity.position.x,
            y: targetEntity.approach?.y ?? 0.19,
            z: targetEntity.approach?.z ?? targetEntity.position.z,
          };
        }
      }

      if (nextTarget) {
        agent.targetDestination = nextTarget;
        const pathResult = this.navService.findPath(agent.currentPosition, nextTarget);
        agent.waypoints = pathResult.waypoints.length > 0 ? pathResult.waypoints : [nextTarget];
        agent.waypointIndex = 0;
        agent.lastAction = `goto:${directive.targetCategory || directive.targetEntityId}`;

        this.worldGateway.broadcastDomainEvent({
          name: 'agent.target',
          payload: {
            agentId: config.id,
            targetPosition: nextTarget,
            action: 'goto',
            instruction: directive,
          },
        });
      }
    } else if (actionRequired === 'stop') {
      agent.targetDestination = null;
      agent.waypoints = [];
      agent.waypointIndex = 0;
      agent.lastAction = 'wait:stopped_by_daniel';

      this.worldGateway.broadcastDomainEvent({
        name: 'agent.target',
        payload: {
          agentId: config.id,
          targetPosition: null,
          action: 'stop',
          instruction: directive,
        },
      });
    }

    const trafficLight = this.worldGateway.getTrafficLightState();

    try {
      // Tenta deliberação de resposta conversacional via LLM
      let response: string | undefined | null;
      try {
        response = await this.cognitionService.generateConversationalDialogue?.({
          citizenId: config.id as CitizenId,
          citizenName: config.name,
          citizenRole: config.role,
          starDesignation: config.starDesignation,
          backstorySeed: config.backstorySeed,
          activeGoals: config.activeGoals,
          playerMessage: `[INSTRUÇÃO DO AVATAR DANIEL]: "${playerMessage}". Responda confirmando que ouviu, gravou e está cumprindo esta instrução.`,
          trafficLight,
        });
      } catch {
        // Ignora se LLM der 429 ou falhar
      }

      // Se LLM falhou, retornou mensagem de erro ou deu rate limit, usa o confirmationSpeech gerado especificamente para a instrução
      if (!response || response.toLowerCase().includes('rate limit') || response.length < 5) {
        response = confirmationSpeech;
      }

      if (agent) {
        agent.lastSpeech = response;
        agent.lastAction = `dialogue_instruction_${directive.directiveType}`;
      }

      // 6. Emite a fala do habitante para o balão flutuante no 3D
      this.worldGateway.broadcastDomainEvent({
        name: 'agent.speech',
        payload: {
          agentId: config.id,
          message: response,
        },
      });

      // 7. Emite evento de instrução aprendida para sincronização no cliente
      this.worldGateway.broadcastDomainEvent({
        name: 'agent.instruction.learned',
        payload: {
          agentId: config.id,
          directive,
          playerMessage,
          response,
        },
      });

      // 8. Emite evento de diálogo para a interface de bate-papo do cliente
      this.worldGateway.broadcastDomainEvent({
        name: 'agent.dialogue.response',
        payload: {
          agentId: config.id,
          agentName: config.name,
          playerMessage,
          response,
          directive,
          timestamp: new Date().toISOString(),
        },
      });

      return { response, agentId: config.id, directive };
    } catch (err) {
      this.logger.error(`Erro ao processar diálogo de ${config.id}: ${(err as Error).message}`);
      return { response: confirmationSpeech, agentId: config.id, directive };
    }
  }

  /**
   * Gera saudação contextual quando Daniel se aproxima espontaneamente.
   */
  private generatePlayerProximityGreeting(
    config: SeedCitizenConfig,
    trafficLight: 'green' | 'yellow' | 'red',
  ): string {
    const isGreen = trafficLight === 'green';
    switch (config.id) {
      case 'agent-vega':
        return isGreen
          ? 'Olá Daniel! Sinal verde para veículos — aguarde com segurança na calçada.'
          : 'Olá Daniel! Sinal fechado para os carros, a faixa de pedestres está segura.';
      case 'agent-sulafat':
        return 'Olá Daniel! Cuidando da nossa praça? Vamos manter as calçadas limpas e sustentáveis.';
      case 'agent-sheliak':
        return 'E aí Daniel! Analisando os semáforos da Avenida Central, o fluxo está fluindo bem.';
      case 'agent-epsilon':
        return 'Saudações, jovem Daniel. É sempre revigorante ver cidadãos conscientes em nossa cidade.';
      case 'agent-chason':
        return 'E aí Daniel! O trânsito tá suave hoje, bora curtir a praça com responsabilidade!';
      case 'agent-aladfar':
        return 'Oi Daniel! Reparou nas cores da cidade refletindo nas fachadas da rua?';
      case 'agent-xihe':
        return 'Olá Daniel! Estou conferindo as espécies botânicas dos canteiros da calçada.';
      default:
        return `Olá Daniel! Bom ver você por aqui na Rua Central.`;
    }
  }

  /**
   * Síntese de resposta conversacional quando Daniel faz uma pergunta ou envia mensagem.
   */
  private generateConversationalResponse(
    config: SeedCitizenConfig,
    playerMessage: string,
    trafficLight: 'green' | 'yellow' | 'red',
  ): string {
    const text = playerMessage.toLowerCase();

    // Saudação básica
    if (text.includes('olá') || text.includes('oi') || text.includes('bom dia') || text.includes('boa tarde') || text.includes('tudo bem')) {
      switch (config.id) {
        case 'agent-vega':
          return 'Olá Daniel! Tudo tranquilo por aqui na segurança viária. Lembre-se de sempre olhar para os dois lados antes de cruzar a via.';
        case 'agent-sulafat':
          return 'Oi Daniel! Tudo ótimo! Estava catalogando a flora da praça e conferindo a coleta seletiva nas lixeiras municipais.';
        case 'agent-sheliak':
          return 'Fala Daniel! Tudo em ordem. Eu estava calculando a sincronia semafórica e verificando a passagem dos veículos.';
        case 'agent-epsilon':
          return 'Saudações fraternas, Daniel. A convivência nesta cidade floresce quando cada cidadão compartilha respeito e empatia.';
        case 'agent-chason':
          return 'E aí Daniel! Beleza pura? Tô aproveitando a calçada livre pra dar umas manobras de skate, mas sempre respeitando quem tá a pé!';
        case 'agent-aladfar':
          return 'Oi Daniel! Que bom ver você por aqui. As linhas, luzes e reflexos dessa avenida são pura inspiração visual!';
        case 'agent-xihe':
          return 'Olá Daniel! Tudo ótimo! Estava catalogando a copa das árvores e conferindo a umidade dos canteiros da calçada.';
        default:
          return `Olá Daniel! Prazer em falar com você. O que gostaria de saber sobre nosso distrito?`;
      }
    }

    // Perguntas sobre trânsito, sinal, semáforo, travessia
    if (text.includes('sinal') || text.includes('semáforo') || text.includes('faixa') || text.includes('atravessar') || text.includes('trânsito') || text.includes('carro')) {
      switch (config.id) {
        case 'agent-vega':
          return `Atualmente o sinal da via principal está ${trafficLight === 'green' ? 'VERDE para veículos — pedestres aguardam na calçada de espera' : 'VERMELHO para veículos — travessia permitida na faixa'}! Segurança sempre em primeiro lugar.`;
        case 'agent-sheliak':
          return 'Nossos semáforos operam no padrão DENATRAN com 8s de verde, 3s de atenção amarela e 8s de transversal. Uma sincronização matemática precisa!';
        case 'agent-chason':
          return 'Quando o sinal fecha pros carros, a faixa de pedestres fica liberada pra gente cruzar! Mas no verde deles, fico esperando na calçada.';
        case 'agent-aladfar':
          return `Adoro como as luzes do semáforo criam um ritmo na cidade! No momento está ${trafficLight === 'green' ? 'verde para veículos — pedestres aguardam' : 'vermelho para veículos — travessia liberada'}!`;
        case 'agent-xihe':
          return `O semáforo está em estado ${trafficLight}. Uma mobilidade equilibrada garante a segurança dos pedestres e a integridade dos canteiros verdes.`;
        default:
          return `O semáforo está em estado ${trafficLight}. Respeitar as faixas de retenção garante a integridade de todos na cidade.`;
      }
    }

    // Perguntas sobre lixo, praça, sustentabilidade e regras
    if (text.includes('lixo') || text.includes('praça') || text.includes('limpeza') || text.includes('regra') || text.includes('lei')) {
      switch (config.id) {
        case 'agent-sulafat':
          return 'Seguimos a Lei Federal 12.305/10 (Política Nacional de Resíduos Sólidos). A lixeira municipal fica em frente à placa de advertência ecológica.';
        case 'agent-epsilon':
          return 'As regras urbanas não são prisões, Daniel, mas a partitura que permite que mentes diversas convivam em harmonia.';
        case 'agent-aladfar':
          return 'O design urbano só é verdadeiramente belo quando o espaço público é limpo e respeitado por todos nós.';
        case 'agent-xihe':
          return 'A separação correta de resíduos e a proteção da flora da praça são fundamentais para o ecossistema de Synapse City!';
        default:
          return 'A preservação dos espaços públicos e a destinação correta dos resíduos são deveres de todos os cidadãos da cidade.';
      }
    }

    // Resposta padrão personalizada pelo arquétipo
    switch (config.id) {
      case 'agent-vega':
        return `Compreendido, Daniel! Como responsável pela patrulha urbana, meu dever é manter a ordem e a segurança para todos os habitantes.`;
      case 'agent-sulafat':
        return `Interessante seu ponto de vista, Daniel. Vou registrar essa observação em nossos estudos de impacto ambiental e ecologia urbana.`;
      case 'agent-sheliak':
        return `Boa reflexão, Daniel! A infraestrutura urbana e a engenharia de mobilidade dependem de cidadãos participativos como você.`;
      case 'agent-epsilon':
        return `Suas palavras ecoam a eterna busca humana por sentido na urbe, Daniel. Cada encontro na praça enriquece nossa memória coletiva.`;
      case 'agent-chason':
        return `Maneiro falar contigo, Daniel! Se precisar de uma dica das melhores rotas de skate pela calçada, é só chamar!`;
      case 'agent-aladfar':
        return `Excelente perspectiva, Daniel! Cada diálogo como esse me inspira a pensar novas formas de arte e harmonia urbana.`;
      case 'agent-xihe':
        return `Com certeza, Daniel. A sustentabilidade e o convívio urbano florescem quando cada cidadão faz a sua parte.`;
      default:
        return `Entendi perfeitamente sua mensagem, Daniel. Vamos juntos fazer da Cidade Virtual um lugar cada vez melhor!`;
    }
  }

  /**
   * Constrói falas e monólogos interiores expressivos alinhados aos arquétipos da Constelação de Lira.
   */
  private generateAgentSpeech(
    config: SeedCitizenConfig,
    action: { actionType: string; reasonCode?: string; expectedOutcome?: string },
    trafficLight: 'green' | 'yellow' | 'red',
  ): string {
    const isTrafficGreen = trafficLight === 'green';

    switch (config.id) {
      case 'agent-vega':
        return isTrafficGreen
          ? 'Sinal veicular verde. Garantindo que os pedestres aguardem com segurança na calçada.'
          : 'Sinal fechado para veículos! Faixa liberada para travessia segura.';

      case 'agent-sulafat':
        return 'Verificando as lixeiras municipais e a arborização urbana ao redor da praça.';

      case 'agent-sheliak':
        return 'Avaliando a fluidez do tráfego e a sincronização do semáforo da Avenida Central.';

      case 'agent-epsilon':
        return 'Observando como as regras e o respeito mútuo criam harmonia na Cidade Virtual.';

      case 'agent-chason':
        return isTrafficGreen
          ? 'Sinal verde para os carros! Parando o skate na calçada antes da faixa.'
          : 'Sinal vermelho para carros! Hora de cruzar para a praça.';

      case 'agent-aladfar':
        return 'Observando a harmonia das cores nos edifícios e o contraste dos reflexos de vidro na calçada.';

      case 'agent-xihe':
        return 'Monitorando o desenvolvimento das mudas e a distribuição de sombra natural pela praça.';

      default:
        return 'Em patrulhamento ativo pelas vias municipais.';
    }
  }

  /**
   * Retorna os estados em tempo real de todos os agentes para auditoria ou depuração.
   */
  getAgentStates(): Map<string, AutonomousAgentRuntimeState> {
    return this.agentStates;
  }

  /**
   * Salva o snapshot atômico das mentes de todos os agentes no PostgreSQL (Task-036).
   */
  async saveAllAgentMinds(): Promise<{ durationMs: number; savedCount: number }> {
    if (!this.agentMindRepo) return { durationMs: 0, savedCount: 0 };

    const start = Date.now();
    const rows = Array.from(this.agentStates.values()).map((state) => {
      const serialized = state.mind.serializeState();
      return {
        agentId: serialized.agentId,
        needs: serialized.needs,
        memory: serialized.memory,
        currentIntention: serialized.currentIntention,
        currentActivity: serialized.currentActivity,
      };
    });

    try {
      if (typeof this.agentMindRepo.saveAll === 'function') {
        await this.agentMindRepo.saveAll(rows);
      } else if (typeof this.agentMindRepo.upsert === 'function') {
        for (const row of rows) {
          await this.agentMindRepo.upsert(row);
        }
      }
    } catch (err) {
      this.logger.warn(`[Task-036] Falha ao salvar snapshots de mentes: ${(err as Error).message}`);
    }

    const durationMs = Date.now() - start;
    this.logger.debug(`[Task-036] Snapshot de ${rows.length} mentes salvo no PostgreSQL em ${durationMs}ms.`);
    return { durationMs, savedCount: rows.length };
  }

  /**
   * Redefine a mente de um agente para as configurações padrão de nascimento (dev/admin reset).
   */
  async resetMind(agentId: string): Promise<void> {
    if (this.agentMindRepo) {
      await this.agentMindRepo.deleteByAgentId(agentId);
    }
    const state = this.agentStates.get(agentId);
    if (state) {
      const citizen = state.config;
      state.mind = new AgentMind({
        id: citizen.id,
        name: citizen.name,
        role: citizen.role,
        biography: citizen.backstorySeed,
        personality: citizen.personality ?? {
          openness: 0.8,
          conscientiousness: 0.7,
          extraversion: 0.7,
          agreeableness: 0.8,
          neuroticism: 0.25,
        },
      });
      this.cognitionService?.registerMind?.(state.mind);
      this.logger.log(`[Task-036] Mente do agente ${agentId} redefinida para baseline.`);
    }
  }

  /**
   * Redefine as mentes de todos os agentes para as configurações padrão.
   */
  async resetAllMinds(): Promise<void> {
    if (this.agentMindRepo) {
      await this.agentMindRepo.deleteAll();
    }
    for (const agentId of this.agentStates.keys()) {
      await this.resetMind(agentId);
    }
    this.logger.log(`[Task-036] Todas as mentes dos agentes foram redefinidas para o baseline.`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await this.saveAllAgentMinds();
    this.logger.log('Motor de simulação autônoma encerrado com sucesso.');
  }
}
