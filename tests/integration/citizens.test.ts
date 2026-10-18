import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
} from '../../packages/persistence';
import { CitizensService } from '../../apps/api/src/modules/citizens/citizens.service';

describe('Task-002 — Integração CitizensService com PostgreSQL', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let agentRepo: AgentIdentityRepository;
  let expRepo: ExperienceRepository;
  let service: CitizensService;

  beforeAll(() => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    agentRepo = new AgentIdentityRepository(conn.db);
    expRepo = new ExperienceRepository(conn.db);
    service = new CitizensService(agentRepo, expRepo);
  });

  afterAll(async () => {
    await conn.close();
  });

  it('deve persistir habitante com UUID v4 no banco e recuperar com sucesso', async () => {
    const created = await service.create({
      name: 'Sulafat',
      archetype: 'worker',
      initialPosition: { lat: 12.5, lng: -45.0, altitude: 1.0 },
      initialEmotion: 'calm',
      backstorySeed: 'Engenheiro de tráfego observando cruzamento central',
    });

    expect(created.id).toBeDefined();

    // Recupera diretamente do banco
    const dbRecord = await agentRepo.getById(created.id);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.id).toBe(created.id);
    expect(dbRecord?.name).toBe('Sulafat');
    expect(dbRecord?.archetype).toBe('worker');
    expect(dbRecord?.emotionState).toBe('calm');
  });

  it('deve sobreviver a restart e manter alterações de emoção', async () => {
    const created = await service.create({
      name: 'Sheliak',
      archetype: 'guard',
      initialPosition: { lat: 8.0, lng: 14.0, altitude: 0 },
      initialEmotion: 'calm',
    });

    await service.setEmotion(created.id, 'curious', 0.9, 120);

    // Simula desconexão e reconexão (restart do servidor)
    await conn.close();

    const newConn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    const newAgentRepo = new AgentIdentityRepository(newConn.db);

    try {
      const persisted = await newAgentRepo.getById(created.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.id).toBe(created.id);
      expect(persisted?.emotionState).toBe('curious');
    } finally {
      await newConn.close();
      // Restaura conexão para os testes seguintes
      conn = createDatabaseConnection({
        host: 'localhost',
        port: 5433,
        user: 'synapse',
        password: 'synapse_secret_password',
        database: 'synapse_city',
      });
      agentRepo = new AgentIdentityRepository(conn.db);
      expRepo = new ExperienceRepository(conn.db);
      service = new CitizensService(agentRepo, expRepo);
    }
  });
});
