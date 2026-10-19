import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
  AgentMindRepository,
  WorldStateRepository,
} from '../../packages/persistence';
import { MemoryService } from '../../packages/memory';
import { NavigationService } from '../../packages/world-engine';
import { CitizensService } from '../../apps/api/src/modules/citizens/citizens.service';
import { WorldService } from '../../apps/api/src/modules/world/world.service';
import { CognitionService } from '../../apps/api/src/modules/cognition/cognition.service';
import {
  AgentMind,
  SYNAPSE_WORLD_ENTITIES,
  distance2D,
  type Percept,
  type PerceivedActor,
} from '../../packages/agent-planning';
import type { AgentAction, CitizenId } from '@cidade-virtual/types';

describe('Task-041 (DoD Marco MA) — Prova E2E da Autonomia Emergente: "Nasce um Hábito"', () => {
  let dbConn: ReturnType<typeof createDatabaseConnection>;
  let agentRepo: AgentIdentityRepository;
  let expRepo: ExperienceRepository;
  let mindRepo: AgentMindRepository;
  let worldRepo: WorldStateRepository;
  let memoryService: MemoryService;
  let navService: NavigationService;
  let citizensService: CitizensService;
  let worldService: WorldService;
  let cognitionService: CognitionService;

  let lyraId: CitizenId = '' as CitizenId;
  let orionId: CitizenId = '' as CitizenId;

  beforeAll(async () => {
    // 1. Conexão real com PostgreSQL (@ port 5433)
    dbConn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    agentRepo = new AgentIdentityRepository(dbConn.db);
    expRepo = new ExperienceRepository(dbConn.db);
    mindRepo = new AgentMindRepository(dbConn.db);
    worldRepo = new WorldStateRepository(dbConn.db);

    // 2. Conexão real com Qdrant Vector Engine (@ port 6333)
    memoryService = new MemoryService({
      baseUrl: 'http://localhost:6333',
      collectionName: 'ma_autonomy_habit_test',
    });
    await memoryService.ensureCollection();

    // 3. Inicialização da NavMesh Recast WASM
    navService = new NavigationService();
    await navService.initialize();

    // 4. Inicialização dos serviços integrados
    citizensService = new CitizensService(agentRepo, expRepo);
    worldService = new WorldService(worldRepo);
    await worldService.onModuleInit();

    cognitionService = new CognitionService(memoryService as any, expRepo);
  }, 20000);

  afterAll(async () => {
    if (lyraId || orionId) {
      const ids = [lyraId, orionId].filter(Boolean).map((id) => `'${id}'`).join(',');
      if (ids) {
        await dbConn.db.execute(`DELETE FROM agent_experiences WHERE agent_id IN (${ids});`);
        if (lyraId) await mindRepo.deleteByAgentId(lyraId);
        if (orionId) await mindRepo.deleteByAgentId(orionId);
        await dbConn.db.execute(`DELETE FROM agent_identities WHERE id IN (${ids});`);
      }
    }
    await dbConn.close();
  });

  it('deve executar o roteiro completo em 8 passos provando autonomia emergente, persistência hedônica e difusão social', async () => {
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 1: Cidade iniciada; NPC percebe o avatar Daniel se aproximando (Percept com ator player)
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    const citizenLyra = await citizensService.create({
      name: 'Lyra (Pioneira do Hábito)',
      archetype: 'citizen',
      initialPosition: { lat: 5.0, lng: -15.0, altitude: 0.19 },
      initialEmotion: 'curious',
      backstorySeed: 'Habitante autônoma que explora o distrito gastronômico da cidade',
    });

    lyraId = citizenLyra.id;
    expect(lyraId).toBeDefined();
    const persistedIdentity = await agentRepo.getById(lyraId);
    expect(persistedIdentity).not.toBeNull();
    expect(persistedIdentity?.name).toBe('Lyra (Pioneira do Hábito)');

    const initialPos = { x: 5, y: 0.19, z: -15 };
    const playerActor: PerceivedActor = {
      id: 'avatar-daniel',
      name: 'Daniel',
      kind: 'player',
      position: { x: 7, y: 0.19, z: -15 },
      distance: 2.0,
    };

    const initialPercept: Percept = {
      position: initialPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(initialPos, e.approach ?? e.position),
      })),
      actors: [playerActor],
      trafficLight: 'green',
    };

    expect(initialPercept.actors.some((a) => a.kind === 'player')).toBe(true);

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 2: Forma objetivo próprio (necessidades + utilidade; ZERO keyword/ROUTINE_POLICY no trace)
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    let mindLyra = cognitionService.getOrCreateMind(lyraId, {
      name: 'Lyra (Pioneira do Hábito)',
      role: 'Pioneira',
      biography: 'Habitante autônoma em busca de experiências gastronômicas',
      initialNeeds: {
        energy: 0.75,
        hunger: 0.35, // Fome moderada
        social: 0.50,
        curiosity: 0.70,
        fun: 0.60,
      },
    });

    const initialDecision: AgentAction = await cognitionService.processCycle({
      citizenId: lyraId as CitizenId,
      currentObservation: 'Observa o avatar Daniel por perto e sente necessidade de refeição matinal',
      nearbyObjects: ['avatar-daniel', 'cafe-bistro', 'market-central'],
      activeGoal: 'atender_necessidade_alimentacao',
      currentPosition: initialPos,
      percept: initialPercept,
      mind: mindLyra,
    });

    // Verificação estrita de ausência de keywords legadas e conformidade com utilidade pura
    expect(initialDecision.agentId).toBe(lyraId);
    expect(initialDecision.reasonCode).toBe('UTILITY_DECISION');
    expect(initialDecision.parameters.source).toBe('utility');

    const traceStr = JSON.stringify(initialDecision);
    expect(traceStr).not.toContain('ROUTINE_POLICY');
    expect(traceStr).not.toContain('routine_navigation');

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 3: Planeja ≥ 3 passos (HTN + Recast) e executa com navegação real
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    const htnPlan = await cognitionService.getGoalPlanner().generatePlan('comprar_lanche_e_comer', {
      agentId: lyraId,
    });

    expect(htnPlan.id).toBeDefined();
    expect(htnPlan.steps.length).toBeGreaterThanOrEqual(3);
    for (const step of htnPlan.steps) {
      expect(step.status).toBe('pending');
      expect(step.action).toBeDefined();
    }

    // Execução espacial real com Recast NavMesh WASM contornando edifícios e quarteirões
    const navOrigin = { x: -40, y: 0.1, z: -25 };
    const navDest = { x: -10, y: 0.1, z: -25 };
    const navPath = navService.findPath(navOrigin, navDest);

    expect(navPath.success).toBe(true);
    expect(navPath.waypoints.length).toBeGreaterThanOrEqual(3);

    // Valida que todos os waypoints calculados pelo motor Recast são navegáveis no mundo
    for (const wp of navPath.waypoints) {
      expect(navService.isNavigable(wp)).toBe(true);
    }

    // O habitante caminha e atualiza sua coordenada final no PostgreSQL
    const finalWaypoint = navPath.waypoints[navPath.waypoints.length - 1];
    await agentRepo.updateLocation(lyraId, finalWaypoint);

    const updatedLyraLoc = await agentRepo.getById(lyraId);
    expect(updatedLyraLoc?.currentLocation).toEqual(finalWaypoint);

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 4: Registra memória/experiência do resultado (Postgres + Qdrant)
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    const experienceExp = await expRepo.record({
      agentId: lyraId,
      eventType: 'action_completed_safely',
      description: 'Teve uma refeição extremamente saborosa e revigorante no Café Bistro',
      locationId: 'cafe-bistro',
      sourceType: 'action_result',
      confidence: '1.00',
      importance: '0.95',
      relatedEntityIds: ['cafe-bistro'],
      metadata: { success: true, valence: 0.85, affordance: 'eat' },
    });

    expect(experienceExp.id).toBeDefined();
    expect(experienceExp.locationId).toBe('cafe-bistro');

    // Indexa na memória semântica do Qdrant
    const qdrantMemory = await memoryService.addMemory({
      citizenId: lyraId,
      content: experienceExp.description,
      timestamp: new Date(),
      sensoryTags: ['internal', 'social'],
      emotionalWeight: 0.95,
      origin: 'interaction',
      memoryType: 'episodic',
      sourceType: 'action_result',
      confidence: 1.0,
    });

    expect(qdrantMemory.id).toBeDefined();

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 5: Aprende preferência hedônica pelo lugar/ator e persiste no banco
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    mindLyra.integrateExperiences([experienceExp as any]);

    // O Café Bistro torna-se o local favorito de Lyra com preferência hedônica positiva forte
    const lyraLearnedPref = mindLyra.memory.placePreferences?.['cafe-bistro'];
    expect(lyraLearnedPref).toBeDefined();
    expect(lyraLearnedPref).toBeGreaterThan(0.65);

    // Persiste o estado psicológico/hedônico completo de Lyra no PostgreSQL (tabela agent_minds)
    await mindRepo.upsert(mindLyra.serializeState());

    const savedMindRow = await mindRepo.getByAgentId(lyraId);
    expect(savedMindRow).not.toBeNull();
    expect((savedMindRow?.memory as any).placePreferences['cafe-bistro']).toBeCloseTo(lyraLearnedPref!, 3);

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 6: RESTART DA API — Instâncias em memória são destruídas e restauradas do PostgreSQL
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // Simula a morte total do processo da API
    (mindLyra as any) = null;
    (cognitionService as any) = null;

    // Nova inicialização limpa a frio
    const restartedCognitionService = new CognitionService(memoryService as any, expRepo);

    // A mente é recriada e restaurada a partir do snapshot persistido no PostgreSQL
    const snapshotFromDb = await mindRepo.getByAgentId(lyraId);
    expect(snapshotFromDb).not.toBeNull();

    const restoredLyraMind = restartedCognitionService.getOrCreateMind(lyraId, {
      name: 'Lyra (Pioneira do Hábito)',
      role: 'Pioneira',
    });
    restoredLyraMind.restoreState(snapshotFromDb as any);

    // O aprendizado hedônico sobreviveu 100% ao restart da API
    const restoredPref = restoredLyraMind.memory.placePreferences?.['cafe-bistro'];
    expect(restoredPref).toBeDefined();
    expect(restoredPref).toBeCloseTo(lyraLearnedPref!, 3);

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 7: A decisão seguinte diverge em favor do aprendido (Nascimento do Hábito)
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // Coloca Lyra em posição equidistante com fome para decidir
    const decisionPos = { x: 15, y: 0.19, z: -30 };
    const decisionPercept: Percept = {
      position: decisionPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(decisionPos, e.approach ?? e.position),
      })),
      actors: [],
      trafficLight: 'green',
    };

    restoredLyraMind.needs.hunger = 0.25; // Fome relevante

    // Decisão autônoma pós-restart
    const postRestartDecision: AgentAction = await restartedCognitionService.processCycle({
      citizenId: lyraId,
      currentObservation: 'Sente fome e busca local para almoçar na cidade',
      nearbyObjects: ['cafe-bistro', 'market-central'],
      currentPosition: decisionPos,
      percept: decisionPercept,
      mind: restoredLyraMind,
    });

    // O hábito nasceu: Lyra escolhe decisivamente o Café Bistro devido à preferência hedônica aprendida
    expect(postRestartDecision.targetId).toBe('cafe-bistro');
    expect(postRestartDecision.reasonCode).toBe('UTILITY_DECISION');
    expect(postRestartDecision.parameters.affordance).toBe('eat');

    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // PASSO 8: Transmite o aprendizado a outro NPC no socialize (Transmissão Cultural Task-039)
    // ════════════════════════════════════════════════════════════════════════════════════════════════
    // Segundo habitante inicializa sem nenhum viés pelo café
    const citizenOrion = await citizensService.create({
      name: 'Orion (Vizinho Curioso)',
      archetype: 'citizen',
      initialPosition: { lat: 16.0, lng: -29.0, altitude: 0.19 },
      initialEmotion: 'calm',
      backstorySeed: 'Morador novo que ainda não conhece bem os restaurantes locais',
    });
    orionId = citizenOrion.id;
    expect(orionId).toBeDefined();

    const mindOrion = restartedCognitionService.getOrCreateMind(orionId, {
      name: 'Orion (Vizinho Curioso)',
      role: 'Cidadão',
    });
    expect(mindOrion.memory.placePreferences?.['cafe-bistro']).toBeUndefined();

    // Encontro espontâneo e diálogo social entre Lyra e Orion
    const socialExchange = restoredLyraMind.interactWithAgentPeer(mindOrion);

    expect(socialExchange.greetingFromSelf).toContain('Orion');
    expect(socialExchange.replyFromPeer).toContain('Lyra');

    // Transmissão cultural com o fator de decaimento geracional de 0.85
    const transmittedVal = socialExchange.transmittedPreferences.transmittedFromSelf['cafe-bistro'];
    expect(transmittedVal).toBeDefined();
    const currentLyraPref = restoredLyraMind.memory.placePreferences!['cafe-bistro'];
    expect(transmittedVal).toBeCloseTo(currentLyraPref * 0.85, 3);

    // Orion assimilou o hábito e agora também prefere o Café Bistro
    const orionPref = mindOrion.memory.placePreferences?.['cafe-bistro'];
    expect(orionPref).toBeDefined();
    expect(orionPref).toBeGreaterThan(0.5);

    // Quando Orion sente fome, a cultura transmitida modula sua escolha
    mindOrion.needs.hunger = 0.25;
    const orionDecision: AgentAction = await restartedCognitionService.processCycle({
      citizenId: orionId,
      currentObservation: 'Após conversar com Lyra, sente vontade de almoçar',
      nearbyObjects: ['cafe-bistro', 'market-central'],
      currentPosition: decisionPos,
      percept: decisionPercept,
      mind: mindOrion,
    });

    expect(orionDecision.targetId).toBe('cafe-bistro');
    expect(orionDecision.reasonCode).toBe('UTILITY_DECISION');
  });
});
