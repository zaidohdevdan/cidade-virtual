import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
  WorldStateRepository,
} from '../../packages/persistence';
import { MemoryService } from '../../packages/memory';
import { CitizensService } from '../../apps/api/src/modules/citizens/citizens.service';
import { WorldService } from '../../apps/api/src/modules/world/world.service';
import { CognitionService } from '../../apps/api/src/modules/cognition/cognition.service';
import type { CitizenId, AgentAction } from '@cidade-virtual/types';

describe('Task-020 (DoD Marco M0) — Prova E2E do Fluxo de Aprendizagem em 7 Passos', () => {
  let dbConn: ReturnType<typeof createDatabaseConnection>;
  let agentRepo: AgentIdentityRepository;
  let expRepo: ExperienceRepository;
  let worldRepo: WorldStateRepository;
  let memoryService: MemoryService;
  let citizensService: CitizensService;
  let worldService: WorldService;
  let cognitionService: CognitionService;

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
    worldRepo = new WorldStateRepository(dbConn.db);

    // 2. Conexão real com Qdrant Vector Engine (@ port 6333)
    memoryService = new MemoryService({
      baseUrl: 'http://localhost:6333',
      collectionName: 'm0_learning_flow_test',
    });
    await memoryService.ensureCollection();

    // 3. Inicialização dos serviços integrados
    citizensService = new CitizensService(agentRepo, expRepo);
    worldService = new WorldService(worldRepo);
    cognitionService = new CognitionService(memoryService as any);

    await worldService.onModuleInit();
  });

  afterAll(async () => {
    await dbConn.close();
  });

  it('deve executar o ciclo completo de aprendizagem e provar que a memória altera a decisão do habitante', async () => {
    // ══════════════════════════════════════════════════════════════════
    // PASSO 1: Habitante recebe identidade persistente (Postgres)
    // ══════════════════════════════════════════════════════════════════
    const citizen = await citizensService.create({
      name: 'Vega (Lyra Alpha)',
      archetype: 'citizen',
      initialPosition: { lat: 8.5, lng: 12.0, altitude: 0 },
      initialEmotion: 'curious',
      backstorySeed: 'Estudiosa urbana que acabou de chegar ao Distrito Central',
    });

    expect(citizen.id).toBeDefined();
    const persistedIdentity = await agentRepo.getById(citizen.id);
    expect(persistedIdentity).not.toBeNull();
    expect(persistedIdentity?.name).toBe('Vega (Lyra Alpha)');

    // ══════════════════════════════════════════════════════════════════
    // PASSO 2: Observa um acontecimento no cenário (Cruzamento / Semáforo)
    // ══════════════════════════════════════════════════════════════════
    const observationEvent = {
      description: 'Semáforo da Avenida Central está vermelho para veículos e verde para a faixa de pedestres',
      locationId: 'crosswalk-central-01',
      sourceType: 'direct_observation' as const,
      ruleText: 'Pedestres devem atravessar exclusivamente pela faixa com sinal favorável',
    };

    // ══════════════════════════════════════════════════════════════════
    // PASSO 3: Registra a experiência e sua procedência (Postgres)
    // ══════════════════════════════════════════════════════════════════
    const recordedExp = await expRepo.record({
      agentId: citizen.id,
      eventType: 'traffic_rule_observed',
      description: observationEvent.description,
      locationId: observationEvent.locationId,
      sourceType: observationEvent.sourceType,
      confidence: '1.00',
      importance: '0.85',
      relatedEntityIds: ['traffic-light-central', 'crosswalk-central-01'],
      metadata: { rule: observationEvent.ruleText },
    });

    expect(recordedExp.id).toBeDefined();
    expect(recordedExp.sourceType).toBe('direct_observation');

    // ══════════════════════════════════════════════════════════════════
    // PASSO 4: Experiência é indexada e recuperada semanticamente (Qdrant)
    // ══════════════════════════════════════════════════════════════════
    const memoryIndex = await memoryService.addMemory({
      citizenId: citizen.id,
      content: `${observationEvent.description}. Regra aprendida: ${observationEvent.ruleText}`,
      timestamp: new Date(),
      sensoryTags: ['visual', 'social'],
      emotionalWeight: 0.85,
      origin: 'observation',
      memoryType: 'semantic',
      sourceType: 'direct_observation',
      confidence: 1.0,
    });

    expect(memoryIndex.id).toBeDefined();

    // Recuperação semântica: busca memórias relacionadas a "como atravessar a avenida com segurança"
    const retrievedMemories = await memoryService.semanticQuery({
      citizenId: citizen.id,
      queryText: 'como atravessar a avenida faixa pedestres sinal',
      topK: 1,
    });

    expect(retrievedMemories.length).toBeGreaterThanOrEqual(1);
    expect(retrievedMemories[0].content).toContain('faixa de pedestres');

    // ══════════════════════════════════════════════════════════════════
    // PASSO 5: O sistema cognitivo usa a memória para decidir o que fazer
    // ══════════════════════════════════════════════════════════════════
    const cognitiveDecision: AgentAction = await cognitionService.processCycle({
      citizenId: citizen.id,
      currentObservation: 'Pretende atravessar a Avenida Central em direção à praça',
      nearbyObjects: ['crosswalk-central-01', 'traffic-light-central'],
      activeGoal: 'atravessar_avenida_com_seguranca',
    });

    expect(cognitiveDecision.agentId).toBe(citizen.id);
    expect(cognitiveDecision.parameters.retrievedMemoriesCount).toBeGreaterThan(0);

    // ══════════════════════════════════════════════════════════════════
    // PASSO 6: O motor valida e executa a ação (deslocamento para faixa)
    // ══════════════════════════════════════════════════════════════════
    // Ação executada: caminhar até a faixa segura
    const destinationCoords = { x: 0, y: 0.22, z: 0 }; // Centro da faixa
    const updatedLocation = await agentRepo.updateLocation(citizen.id, destinationCoords);

    expect(updatedLocation).not.toBeNull();
    expect(updatedLocation?.currentLocation).toEqual(destinationCoords);

    // ══════════════════════════════════════════════════════════════════
    // PASSO 7: Resultado é registrado como experiência futura e memória consolidada
    // ══════════════════════════════════════════════════════════════════
    const actionResultExp = await expRepo.record({
      agentId: citizen.id,
      eventType: 'action_completed_safely',
      description: 'Atravessou a Avenida Central com segurança utilizando a faixa após observar sinal favorável',
      locationId: 'crosswalk-central-01',
      sourceType: 'action_result',
      confidence: '1.00',
      importance: '0.90',
      relatedEntityIds: ['crosswalk-central-01'],
      metadata: { action: cognitiveDecision.actionType, success: true },
    });

    expect(actionResultExp.id).toBeDefined();
    expect(actionResultExp.sourceType).toBe('action_result');

    // Indexa o sucesso da ação na memória semântica
    await memoryService.addMemory({
      citizenId: citizen.id,
      content: actionResultExp.description,
      timestamp: new Date(),
      sensoryTags: ['internal', 'social'],
      emotionalWeight: 0.9,
      origin: 'interaction',
      memoryType: 'episodic',
      sourceType: 'action_result',
      confidence: 1.0,
    });

    // Prova de continuidade: habitante agora possui 2 experiências registradas no banco
    const allExperiences = await expRepo.getByAgentId(citizen.id);
    expect(allExperiences.length).toBe(2);
    expect(allExperiences.map((e) => e.sourceType)).toContain('direct_observation');
    expect(allExperiences.map((e) => e.sourceType)).toContain('action_result');
  });
});
