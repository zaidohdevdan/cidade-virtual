// apps/api/src/modules/simulation/simulation.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject } from '@nestjs/common';
import { NavigationService, Vector3Like } from '@cidade-virtual/world-engine';
import { AgentIdentityRepository, ExperienceRepository } from '@cidade-virtual/persistence';
import { WorldGateway } from '../../gateways/world.gateway';
import { CognitionService } from '../cognition/cognition.service';
import { WorldService } from '../world/world.service';
import { CitizensService } from '../citizens/citizens.service';
import { SEED_CITIZENS, SeedCitizenConfig } from '../citizens/citizens.seed';

export interface AutonomousAgentRuntimeState {
  config: SeedCitizenConfig;
  currentPosition: Vector3Like;
  targetDestination: Vector3Like | null;
  waypoints: Vector3Like[];
  waypointIndex: number;
  lastAction: string;
  lastSpeech: string;
  goalIndex: number;
  isDeliberating: boolean;
}

/**
 * POIs urbanos canônicos da Rua Central e praça para ancorar destinos deliberativos.
 */
export const URBAN_DESTINATIONS: Record<string, Vector3Like[]> = {
  'agent-vega': [
    { x: -4, y: 0.19, z: -10 },  // Faixa de pedestres oeste
    { x: 4, y: 0.19, z: -10 },   // Faixa de pedestres leste
    { x: -4, y: 0.19, z: -25 },  // Calçada sul (posto de vigília)
  ],
  'agent-sulafat': [
    { x: -25, y: 0.19, z: -5 },  // Lixeira municipal e placa ecológica
    { x: -20, y: 0.19, z: 8 },   // Canteiros e praça central
    { x: -16, y: 0.19, z: -5 },  // Calçada de pesquisa ambiental
  ],
  'agent-sheliak': [
    { x: 20, y: 0.19, z: -14 },  // Mercado Municipal (inspeção de mobilidade)
    { x: 8, y: 0.19, z: -10 },   // Totem do semáforo nordeste
    { x: 22, y: 0.19, z: -6 },   // Circulação viária leste
  ],
  'agent-epsilon': [
    { x: 16, y: 0.19, z: 22 },   // Banco da praça histórica
    { x: 20, y: 0.19, z: 8 },    // Edifício Norte
    { x: 8, y: 0.19, z: 12 },    // Alameda de reflexão cívica
  ],
  'agent-chason': [
    { x: 10, y: 0.19, z: 14 },   // Pista de patinação e skate
    { x: -12, y: 0.19, z: 14 },  // Canteiro central florido
    { x: 6, y: 0.19, z: 4 },     // Travessia assistida
  ],
  'agent-aladfar': [
    { x: -16, y: 0.19, z: 16 },  // Mural de arte urbana
    { x: -24, y: 0.19, z: 22 },  // Galeria ao ar livre
    { x: -18, y: 0.19, z: 8 },   // Pátio da arquitetura
  ],
  'agent-xihe': [
    { x: -10, y: 0.19, z: -20 }, // Corredor botânico oeste
    { x: -12, y: 0.19, z: -12 }, // Jardins suspensos
    { x: -8, y: 0.19, z: -28 },  // Canteiro de espécies nativas
  ],
};

@Injectable()
export class AutonomousSimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutonomousSimulationService.name);
  private navService: NavigationService;
  private heartbeatTimer: NodeJS.Timeout | null = null;
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

    // 2. Registra e sincroniza estados dos 7 agentes canônicos
    for (const citizen of SEED_CITIZENS) {
      this.agentStates.set(citizen.id, {
        config: citizen,
        currentPosition: { ...citizen.initialPosition },
        targetDestination: null,
        waypoints: [],
        waypointIndex: 0,
        lastAction: 'observe',
        lastSpeech: '',
        goalIndex: 0,
        isDeliberating: false,
      });
    }

    // 3. Inicia Heartbeat Autônomo da Cidade (Ciclo deliberativo e locomoção contínua) fora de testes
    const isTest = !!process.env['VITEST'] || process.env['NODE_ENV'] === 'test';
    if (!isTest) {
      const tickIntervalMs = Number(process.env['SIMULATION_TICK_INTERVAL_MS'] ?? 3500);
      this.heartbeatTimer = setInterval(() => {
        this.executeSimulationStep().catch((err) => {
          this.logger.error(`Erro no loop da simulação autônoma: ${(err as Error).message}`);
        });
      }, tickIntervalMs);

      this.logger.log(`Heartbeat da Cidade Virtual ativo (intervalo: ${tickIntervalMs}ms, ${this.agentStates.size} agentes autônomos).`);
    } else {
      this.logger.log(`Ambiente de testes detectado: Heartbeat em modo controlado.`);
    }
  }

  /**
   * Executa um passo do ciclo de vida da cidade:
   * 1. Avança tick do mundo
   * 2. Sincroniza semáforo na NavMesh
   * 3. Delibera cognição para o próximo habitante da fila circular
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
    const destinations = URBAN_DESTINATIONS[agent.config.id] ?? [agent.config.initialPosition];
    
    // Se o agente não tem destino ou já atingiu o destino atual, define próximo ponto da rota urbana
    if (!agent.targetDestination || (agent.waypoints.length > 0 && agent.waypointIndex >= agent.waypoints.length)) {
      const nextTarget = destinations[agent.goalIndex % destinations.length];
      agent.goalIndex++;
      agent.targetDestination = nextTarget;

      // Calcula caminho inteligente evitando prédios e respeitando faixas/semáforos via Recast Navigation
      const pathResult = this.navService.findPath(agent.currentPosition, nextTarget, {
        trafficLightState: trafficLight,
      });

      agent.waypoints = pathResult.waypoints.length > 0 ? pathResult.waypoints : [nextTarget];
      agent.waypointIndex = 0;
    }

    // Avança para o próximo waypoint do caminho
    let nextPos: Vector3Like = agent.currentPosition;
    if (agent.waypoints.length > 0 && agent.waypointIndex < agent.waypoints.length) {
      nextPos = agent.waypoints[agent.waypointIndex];
      agent.waypointIndex++;
      agent.currentPosition = nextPos;

      // 1. Transmite evento de locomoção autoritativa para o frontend
      this.worldGateway.broadcastDomainEvent({
        name: 'agent.moved',
        payload: {
          agentId: agent.config.id,
          position: { x: nextPos.x, y: nextPos.y ?? 0.19, z: nextPos.z },
        },
      });

      // 2. Persiste nova localização no PostgreSQL se o repositório estiver ativo
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

    // 3. Executa ciclo cognitivo (GoalPlanner + LangGraph + Memória Vetorial Qdrant)
    const currentGoal = agent.config.activeGoals[agent.goalIndex % agent.config.activeGoals.length];
    try {
      const action = await this.cognitionService.processCycle({
        citizenId: agent.config.id as any,
        currentObservation: `Localizado em [${nextPos.x.toFixed(1)}, ${nextPos.z.toFixed(1)}] na Rua Central. Semáforo está ${trafficLight}.`,
        nearbyObjects: ['semaforo-1', 'faixa-pedestres', 'calcada-central'],
        activeGoal: currentGoal,
      });

      agent.lastAction = action.actionType;

      // 4. Formata pensamento ou fala contextual do habitante
      const speechMessage = this.generateAgentSpeech(agent.config, action, trafficLight);
      agent.lastSpeech = speechMessage;

      // 5. Emite fala/pensamento para o balão flutuante no 3D
      this.worldGateway.broadcastDomainEvent({
        name: 'agent.speech',
        payload: {
          agentId: agent.config.id,
          message: speechMessage,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha na deliberação cognitiva de ${agent.config.id}: ${(err as Error).message}`);
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
        return 'A luz do entardecer reflete tons incríveis nas fachadas da Rua Central!';

      case 'agent-xihe':
        return 'Catalogando as mudas e a umidade do solo nos canteiros da calçada oeste.';

      default:
        return action.expectedOutcome || `Executando plano: ${action.actionType}`;
    }
  }

  /**
   * Retorna os estados em tempo real de todos os agentes para auditoria ou depuração.
   */
  getAgentStates(): Map<string, AutonomousAgentRuntimeState> {
    return this.agentStates;
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.logger.log('Motor de simulação autônoma encerrado com sucesso.');
  }
}
