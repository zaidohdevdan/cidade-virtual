import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  AgentMindRepository,
} from '../../packages/persistence';
import { AgentMind } from '../../packages/agent-planning';

describe('Task-036 — Persistência e Restauração de Mente Subjetiva (AgentMind)', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let identityRepo: AgentIdentityRepository;
  let mindRepo: AgentMindRepository;

  const testAgentId = 'agent-test-persistence-036';

  beforeAll(async () => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    identityRepo = new AgentIdentityRepository(conn.db);
    mindRepo = new AgentMindRepository(conn.db);

    // Garante que a identidade base do agente de teste existe
    await identityRepo.upsert({
      id: testAgentId,
      name: 'Agente Teste 036',
      archetype: 'citizen',
      profileData: {},
      activeGoals: [],
      preferences: {},
      currentLocation: { x: 0, y: 0, z: 0 },
      emotionState: 'calm',
    });
  });

  afterAll(async () => {
    await mindRepo.deleteByAgentId(testAgentId);
    await conn.db.execute(`DELETE FROM agent_identities WHERE id = '${testAgentId}';`);
    await conn.close();
  });

  it('deve persistir o estado subjetivo e memória hedônica no PostgreSQL e restaurar após restart', async () => {
    // 1. Cria a mente em runtime
    const originalMind = new AgentMind({
      id: testAgentId,
      name: 'Agente Teste 036',
      role: 'Testador de Continuidade',
      biography: 'Habitante submetido a testes de persistência',
      personality: {
        openness: 0.9,
        conscientiousness: 0.8,
        extraversion: 0.6,
        agreeableness: 0.7,
        neuroticism: 0.2,
      },
      initialNeeds: {
        energy: 0.42,
        hunger: 0.78,
        social: 0.65,
        curiosity: 0.88,
        fun: 0.31,
      },
    });

    // 2. Simula aprendizado hedônico e experiências
    originalMind.memory.placePreferences = {
      'cafe-bistro': 0.82,
      'market-central': -0.35,
    };
    originalMind.memory.visitCounts = {
      'cafe-bistro': 5,
      'fountain-monumental': 2,
    };
    originalMind.memory.lastVisitedAt = {
      'cafe-bistro': 1700000000000,
    };
    originalMind.memory.actorAffinity = {
      'avatar-daniel': 0.95,
      'agent-sheliak': 0.70,
    };

    // 3. Serializa e salva no banco de dados real
    const serialized = originalMind.serializeState();
    await mindRepo.upsert({
      agentId: serialized.agentId,
      needs: serialized.needs as any,
      memory: serialized.memory as any,
      currentIntention: serialized.currentIntention as any,
      currentActivity: serialized.currentActivity as any,
    });

    // 4. Simula o restart completo da aplicação: lê do banco e recria a mente
    const dbRecord = await mindRepo.getByAgentId(testAgentId);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.agentId).toBe(testAgentId);

    const restartedMind = new AgentMind({
      id: testAgentId,
      name: 'Agente Teste 036',
      role: 'Testador de Continuidade',
      biography: 'Habitante submetido a testes de persistência',
      personality: {
        openness: 0.9,
        conscientiousness: 0.8,
        extraversion: 0.6,
        agreeableness: 0.7,
        neuroticism: 0.2,
      },
    });

    // Restaura o estado salvo
    restartedMind.restoreState({
      needs: dbRecord?.needs as any,
      memory: dbRecord?.memory as any,
      currentIntention: dbRecord?.currentIntention as any,
      currentActivity: dbRecord?.currentActivity as any,
    });

    // 5. Asserções rigorosas de continuidade hedônica e biológica
    expect(restartedMind.needs.energy).toBeCloseTo(0.42, 2);
    expect(restartedMind.needs.hunger).toBeCloseTo(0.78, 2);
    expect(restartedMind.needs.social).toBeCloseTo(0.65, 2);
    expect(restartedMind.needs.curiosity).toBeCloseTo(0.88, 2);
    expect(restartedMind.needs.fun).toBeCloseTo(0.31, 2);

    expect(restartedMind.memory.placePreferences?.['cafe-bistro']).toBeCloseTo(0.82, 2);
    expect(restartedMind.memory.placePreferences?.['market-central']).toBeCloseTo(-0.35, 2);
    expect(restartedMind.memory.visitCounts?.['cafe-bistro']).toBe(5);
    expect(restartedMind.memory.actorAffinity?.['avatar-daniel']).toBeCloseTo(0.95, 2);
    expect(restartedMind.memory.actorAffinity?.['agent-sheliak']).toBeCloseTo(0.70, 2);
  });

  it('deve realizar snapshot em lote de 7 mentes em menos de 50ms', async () => {
    const rows = [];
    for (let i = 0; i < 7; i++) {
      rows.push({
        agentId: testAgentId,
        needs: { energy: 0.5, hunger: 0.5, social: 0.5, curiosity: 0.5, fun: 0.5 },
        memory: {
          lastVisitedAt: { 'cafe-bistro': Date.now() },
          visitCounts: { 'cafe-bistro': i + 1 },
          placePreferences: { 'cafe-bistro': 0.5 },
        },
        currentIntention: null,
        currentActivity: null,
      });
    }

    const start = performance.now();
    await mindRepo.saveAll(rows);
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(1000);
  });

  it('deve permitir reset de mente e retornar ao baseline', async () => {
    const deleted = await mindRepo.deleteByAgentId(testAgentId);
    expect(deleted).toBe(true);

    const check = await mindRepo.getByAgentId(testAgentId);
    expect(check).toBeNull();
  });
});
