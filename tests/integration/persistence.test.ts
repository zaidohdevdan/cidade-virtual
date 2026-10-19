import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  WorldStateRepository,
  AgentIdentityRepository,
  ExperienceRepository,
} from '../../packages/persistence';

describe('Fase 1: Fundação — Persistência e Integridade do Mundo', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let worldRepo: WorldStateRepository;
  let agentRepo: AgentIdentityRepository;
  let expRepo: ExperienceRepository;

  beforeAll(() => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    worldRepo = new WorldStateRepository(conn.db);
    agentRepo = new AgentIdentityRepository(conn.db);
    expRepo = new ExperienceRepository(conn.db);
  });

  afterAll(async () => {
    await conn.close();
  });

  const testWorldId = 'test-persistence-world';

  it('deve persistir e atualizar o estado autoritativo do mundo', async () => {
    const worldId = testWorldId;

    const saved = await worldRepo.upsert({
      id: worldId,
      name: 'Rua Central — Distrito Central',
      tickCount: 42,
      timeOfDay: 14,
      weather: 'clear',
    });

    expect(saved.id).toBe(worldId);
    expect(saved.name).toBe('Rua Central — Distrito Central');
    expect(saved.tickCount).toBe(42);

    // Incrementar tick
    const updated = await worldRepo.incrementTick(worldId, 8);
    expect(updated?.tickCount).toBe(50);

    // Atualizar clima e horário
    const envUpdated = await worldRepo.updateEnvironment(worldId, 18, 'sunset');
    expect(envUpdated?.timeOfDay).toBe(18);
    expect(envUpdated?.weather).toBe('sunset');
  });

  it('deve garantir continuidade do estado do mundo após reinicialização da conexão', async () => {
    const worldId = testWorldId;

    // Criar nova conexão do zero (simulando nova instância da API após reinício)
    const restartConn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    const newWorldRepo = new WorldStateRepository(restartConn.db);

    try {
      // Recuperar estado persistido
      const reloaded = await newWorldRepo.getById(worldId);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.id).toBe(worldId);
      expect(reloaded?.tickCount).toBe(50);
      expect(reloaded?.weather).toBe('sunset');
    } finally {
      await restartConn.close();
    }
  });

  it('deve persistir identidade de habitante e registrar suas experiências', async () => {
    const agentId = 'agent-daniel-01';

    // 1. Criar identidade persistente
    const agent = await agentRepo.upsert({
      id: agentId,
      name: 'Daniel',
      archetype: 'curious_citizen',
      profileData: { age: 30, occupation: 'observador urbano' },
      activeGoals: ['explorar_praca', 'verificar_semaforo'],
      preferences: { walkSpeed: 1.2 },
      currentLocation: { x: 5, y: 0, z: -10 },
      emotionState: 'curious',
    });

    expect(agent.id).toBe(agentId);
    expect(agent.name).toBe('Daniel');

    // 2. Registrar experiência estruturada
    const exp = await expRepo.record({
      agentId,
      eventType: 'traffic_light_observed',
      description: 'Observou semáforo mudando para vermelho na faixa de pedestres',
      locationId: 'crosswalk-central',
      sourceType: 'direct_observation',
      confidence: '1.00',
      importance: '0.80',
      relatedEntityIds: ['traffic-light-01', 'crosswalk-central'],
      metadata: { signal: 'red' },
    });

    expect(exp.id).toBeDefined();
    expect(exp.agentId).toBe(agentId);
    expect(exp.sourceType).toBe('direct_observation');
    expect(exp.relatedEntityIds).toEqual(['traffic-light-01', 'crosswalk-central']);

    // 3. Consultar histórico de experiências do habitante
    const history = await expRepo.getByAgentId(agentId);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].eventType).toBe('traffic_light_observed');
    expect(history[0].relatedEntityIds).toEqual(['traffic-light-01', 'crosswalk-central']);
  });
});
