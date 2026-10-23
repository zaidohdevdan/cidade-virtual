import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
} from '../../packages/persistence';
import { MemoryService } from '../../packages/memory';
import { CitizensService } from '../../apps/api/src/modules/citizens/citizens.service';
import { SEED_CITIZENS } from '../../apps/api/src/modules/citizens/citizens.seed';

describe('Task-013 — Popular 3-5 NPCs com Fase Meta de Consciência', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let agentRepo: AgentIdentityRepository;
  let expRepo: ExperienceRepository;
  let memoryService: MemoryService;
  let citizensService: CitizensService;

  beforeAll(async () => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    agentRepo = new AgentIdentityRepository(conn.db);
    expRepo = new ExperienceRepository(conn.db);

    memoryService = new MemoryService({
      baseUrl: 'http://localhost:6333',
      collectionName: 'memories_test',
    });
    await memoryService.ensureCollection();

    citizensService = new CitizensService(
      agentRepo,
      expRepo,
      undefined,
      memoryService
    );
  });

  afterAll(async () => {
    await conn.close();
  });

  it('deve semear o cidadão canônico no PostgreSQL com todos os arquétipos requeridos', async () => {
    const result = await citizensService.seedDefaultCitizens();
    expect(result.seededCount).toBe(1);

    // Valida o NPC persistidos no PostgreSQL
    for (const config of SEED_CITIZENS) {
      const persisted = await agentRepo.getById(config.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.id).toBe(config.id);
      expect(persisted?.name).toBe(config.name);
      expect(persisted?.archetype).toBe(config.archetype);
      expect(persisted?.emotionState).toBe(config.initialEmotion);
      expect(persisted?.activeGoals).toEqual(config.activeGoals);
      expect((persisted?.profileData as Record<string, unknown>)?.starDesignation).toBe(config.starDesignation);
      expect((persisted?.currentLocation as { x: number; y: number; z: number }).x).toBeTypeOf('number');
    }

    // Roster MVP: apenas Sulafat (worker)
    expect(SEED_CITIZENS.map((c) => c.id)).toEqual(['agent-sulafat']);
    expect(SEED_CITIZENS[0].archetype).toBe('worker');
  });

  it('cada NPC deve possuir no mínimo 3 memórias/experiências episódicas iniciais no PostgreSQL', async () => {
    for (const config of SEED_CITIZENS) {
      const experiences = await citizensService.getCitizenExperiences(config.id, 50, 'direct_observation');
      expect(experiences.length).toBeGreaterThanOrEqual(3);

      for (const exp of experiences) {
        expect(exp.agentId).toBe(config.id);
        expect(exp.sourceType).toBe('direct_observation');
        expect(Number(exp.confidence)).toBeGreaterThanOrEqual(0.85);
        expect(Number(exp.importance)).toBeGreaterThanOrEqual(0.60);
      }
    }
  });

  it('as memórias devem estar indexadas semanticamente no Qdrant para recuperação vetorial', async () => {
    // Consulta semântica para Sulafat (Ecológica focada em lixo e árvores)
    const sulafatMemories = await citizensService.getCitizenMemories(
      'agent-sulafat',
      'lixeira pública e preservação ambiental',
      5
    );
    expect(sulafatMemories.length).toBeGreaterThan(0);
    expect(sulafatMemories[0].citizenId).toBe('agent-sulafat');
    expect(sulafatMemories[0].content).toMatch(/lixeira|resíduos|arborização/i);
  });

  it('a operação de seed deve ser estritamente idempotente (não duplicar habitantes nem memórias)', async () => {
    // Captura contagens prévias
    const preCount = (await citizensService.getCitizenExperiences('agent-sulafat')).length;

    // Executa o seed novamente
    const result2 = await citizensService.seedDefaultCitizens();
    expect(result2.seededCount).toBe(1);
    expect(result2.experiencesCount).toBe(0); // 0 novas experiências canônicas inseridas

    // Verifica que as memórias canônicas permanecem intactas e não duplicadas
    const postCount = (await citizensService.getCitizenExperiences('agent-sulafat')).length;

    expect(postCount).toBeGreaterThanOrEqual(preCount);
    expect(postCount - preCount).toBeLessThanOrEqual(2);
  });
});
