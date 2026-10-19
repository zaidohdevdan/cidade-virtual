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

  it('deve semear os 5 cidadãos canônicos no PostgreSQL com todos os arquétipos requeridos', async () => {
    const result = await citizensService.seedDefaultCitizens();
    expect(result.seededCount).toBe(5);

    // Valida cada um dos 5 NPCs persistidos no PostgreSQL
    for (const config of SEED_CITIZENS) {
      const persisted = await agentRepo.getById(config.id);
      expect(persisted).not.toBeNull();
      expect(persisted?.id).toBe(config.id);
      expect(persisted?.name).toBe(config.name);
      expect(persisted?.archetype).toBe(config.archetype);
      expect(persisted?.emotionState).toBe(config.initialEmotion);
      expect(persisted?.activeGoals).toEqual(config.activeGoals);
      expect((persisted?.profileData as Record<string, unknown>)?.starDesignation).toBe(config.starDesignation);
      expect((persisted?.currentLocation as { x: number; y: number; z: number }).x).toBe(config.initialPosition.x);
    }

    // Valida variedade de arquétipos: worker, guard, citizen, child, elder
    const archetypes = SEED_CITIZENS.map((c) => c.archetype);
    expect(archetypes).toContain('worker');
    expect(archetypes).toContain('guard');
    expect(archetypes).toContain('citizen');
    expect(archetypes).toContain('child');
    expect(archetypes).toContain('elder');
  });

  it('cada NPC deve possuir no mínimo 3 memórias/experiências episódicas iniciais no PostgreSQL', async () => {
    for (const config of SEED_CITIZENS) {
      const experiences = await citizensService.getCitizenExperiences(config.id);
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
    // Consulta semântica para Vega (Guardiã focada em semáforo e segurança)
    const vegaMemories = await citizensService.getCitizenMemories(
      'agent-vega',
      'respeitar faixa de pedestres e semáforo',
      5
    );
    expect(vegaMemories.length).toBeGreaterThan(0);
    expect(vegaMemories[0].citizenId).toBe('agent-vega');
    expect(vegaMemories[0].content).toMatch(/semáforo|patrulha|PROIBIDO JOGAR LIXO/i);

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
    const preCountVega = (await citizensService.getCitizenExperiences('agent-vega')).length;
    const preCountEpsilon = (await citizensService.getCitizenExperiences('agent-epsilon')).length;

    // Executa o seed novamente
    const result2 = await citizensService.seedDefaultCitizens();
    expect(result2.seededCount).toBe(5);
    expect(result2.experiencesCount).toBe(0); // 0 novas experiências inseridas

    // Verifica que as contagens permanecem idênticas
    const postCountVega = (await citizensService.getCitizenExperiences('agent-vega')).length;
    const postCountEpsilon = (await citizensService.getCitizenExperiences('agent-epsilon')).length;

    expect(postCountVega).toBe(preCountVega);
    expect(postCountEpsilon).toBe(preCountEpsilon);
  });
});
