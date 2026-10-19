import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
  AgentMindRepository,
} from '../../packages/persistence';
import {
  AgentMind,
  SYNAPSE_WORLD_ENTITIES,
  distance2D,
  type Percept,
  type Personality,
} from '../../packages/agent-planning';

describe('Task-039 — Integração: Memória Semântica → Utilidade + Transmissão Social NPC-NPC', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let identityRepo: AgentIdentityRepository;
  let expRepo: ExperienceRepository;
  let mindRepo: AgentMindRepository;

  const agentAId = 'agent-social-a-039';
  const agentBId = 'agent-social-b-039';

  const testPersonality: Personality = {
    openness: 0.8,
    conscientiousness: 0.7,
    extraversion: 0.8,
    agreeableness: 0.8,
    neuroticism: 0.2,
  };

  beforeAll(async () => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    identityRepo = new AgentIdentityRepository(conn.db);
    expRepo = new ExperienceRepository(conn.db);
    mindRepo = new AgentMindRepository(conn.db);

    // Cria identidades no PostgreSQL
    await identityRepo.upsert({
      id: agentAId,
      name: 'Aurora',
      archetype: 'citizen',
      profileData: {},
      activeGoals: [],
      preferences: {},
      currentLocation: { x: 5, y: 0.19, z: -15 },
      emotionState: 'calm',
    });

    await identityRepo.upsert({
      id: agentBId,
      name: 'Bóris',
      archetype: 'citizen',
      profileData: {},
      activeGoals: [],
      preferences: {},
      currentLocation: { x: 7, y: 0.19, z: -15 },
      emotionState: 'calm',
    });
  });

  afterAll(async () => {
    await expRepo.deleteByIds([]); // Limpeza seletiva
    await conn.db.execute(`DELETE FROM agent_experiences WHERE agent_id IN ('${agentAId}', '${agentBId}');`);
    await mindRepo.deleteByAgentId(agentAId);
    await mindRepo.deleteByAgentId(agentBId);
    await conn.db.execute(`DELETE FROM agent_identities WHERE id IN ('${agentAId}', '${agentBId}');`);
    await conn.close();
  });

  it('deve consolidar experiência ruim no Postgres, transmitir via conversa de A para B e fazer B evitar o local por N ticks', async () => {
    // ════════════════════════════════════════════════════════════════════════
    // PASSO 1: NPC A vivencia e registra experiência negativa no PostgreSQL
    // ════════════════════════════════════════════════════════════════════════
    const badExp = await expRepo.record({
      agentId: agentAId,
      eventType: 'hazard_observed',
      description: 'Presenciou intoxicação alimentar, risco sanitário e grande confusão no Super Mercado Central',
      locationId: 'market-central',
      sourceType: 'direct_observation',
      confidence: '1.00',
      importance: '0.95',
      relatedEntityIds: ['market-central'],
      metadata: { hazard: true, valence: -0.85 },
    });

    expect(badExp.id).toBeDefined();

    // ════════════════════════════════════════════════════════════════════════
    // PASSO 2: Mente de A integra a experiência consolidada da persistência
    // ════════════════════════════════════════════════════════════════════════
    const mindA = new AgentMind({
      id: agentAId,
      name: 'Aurora',
      role: 'Inspetora',
      biography: 'Habitante atenta à segurança da cidade',
      personality: testPersonality,
    });

    const persistedExpsA = await expRepo.getByAgentId(agentAId, 20);
    expect(persistedExpsA.length).toBeGreaterThanOrEqual(1);

    mindA.integrateExperiences(persistedExpsA as any);

    // O viés hedônico de A para o mercado central passa a ser fortemente negativo
    const prefA = mindA.memory.placePreferences?.['market-central'];
    expect(prefA).toBeDefined();
    expect(prefA).toBeLessThan(-0.6);

    // ════════════════════════════════════════════════════════════════════════
    // PASSO 3: Mente de B inicializa sem nenhum viés contra o mercado central
    // ════════════════════════════════════════════════════════════════════════
    const mindB = new AgentMind({
      id: agentBId,
      name: 'Bóris',
      role: 'Estudante',
      biography: 'Novo morador do bairro',
      personality: testPersonality,
    });

    expect(mindB.memory.placePreferences?.['market-central']).toBeUndefined();

    // ════════════════════════════════════════════════════════════════════════
    // PASSO 4: Encontro social entre A e B — transmissão cultural com decaimento 0.85
    // ════════════════════════════════════════════════════════════════════════
    const dialogue = mindA.interactWithAgentPeer(mindB);

    expect(dialogue.greetingFromSelf).toContain('Bóris');
    expect(dialogue.replyFromPeer).toContain('Aurora');

    // Transmissão social do viés negativo com fator 0.85
    const transmittedVal = dialogue.transmittedPreferences.transmittedFromSelf['market-central'];
    expect(transmittedVal).toBeDefined();
    expect(transmittedVal).toBeCloseTo(prefA! * 0.85, 3);

    // B agora possui o viés negativo transmitido por A
    const prefB = mindB.memory.placePreferences?.['market-central'];
    expect(prefB).toBeDefined();
    expect(prefB).toBeLessThan(-0.5);

    // ════════════════════════════════════════════════════════════════════════
    // PASSO 5: B precisa comer e evita 'market-central' consistentemente por N ticks
    // ════════════════════════════════════════════════════════════════════════
    // B está em um ponto intermediário equidistante do mercado e do café bistro
    const agentBPos = { x: 5, y: 0.19, z: -25 };
    const percept: Percept = {
      position: agentBPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(agentBPos, e.approach ?? e.position),
      })),
      actors: [],
      trafficLight: 'green',
    };

    // Fome relevante: sem o viés negativo, o mercado central competiria diretamente
    mindB.needs.hunger = 0.25;

    const N_TICKS = 5;
    const chosenTargets: string[] = [];

    for (let tick = 0; tick < N_TICKS; tick++) {
      // Arrefecimento temporal contínuo da mente
      mindB.update(15); // 15s por tick simulado

      const intention = await mindB.decideNextIntention(agentBPos, percept);
      chosenTargets.push(intention.candidate.targetId);

      // Verificação essencial: B NUNCA escolhe market-central devido ao viés cultural recebido
      expect(intention.candidate.targetId).not.toBe('market-central');
      expect(['cafe-bistro', 'cafe-table-outdoor']).toContain(intention.candidate.targetId);
      expect(intention.source).toBe('utility');
    }

    expect(chosenTargets.length).toBe(N_TICKS);
    expect(chosenTargets.includes('market-central')).toBe(false);
  });
});
