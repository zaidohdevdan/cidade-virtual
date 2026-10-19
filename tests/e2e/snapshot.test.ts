import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabaseConnection, WorldStateRepository } from '../../packages/persistence';
import { WorldService } from '../../apps/api/src/modules/world/world.service';
import { getSceneSnapshotTool } from '../../apps/api/src/tools';
import { getSceneSnapshotSchema } from '../../packages/tools';

describe('tests/e2e/snapshot.test.ts — E2E da Ferramenta getSceneSnapshotTool', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let worldRepo: WorldStateRepository;
  let worldService: WorldService;
  const testScenarioId = 'c7a4b8d2-1e3f-4a5b-9c8d-7e6f5a4b3c2d';

  beforeAll(async () => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    worldRepo = new WorldStateRepository(conn.db);
    worldService = new WorldService(worldRepo);
    await worldService.onModuleInit();

    // Cria/atualiza cenário específico de teste
    await worldRepo.upsert({
      id: testScenarioId,
      name: 'Cenário de Teste Snapshot E2E',
      tickCount: 100,
      timeOfDay: 14,
      weather: 'clear',
    });
  });

  afterAll(async () => {
    if (conn) {
      await conn.db.execute(`DELETE FROM world_state WHERE id = '${testScenarioId}';`);
      await conn.close();
    }
  });

  it('deve instanciar getSceneSnapshotTool com metadados e schema válidos', () => {
    const tool = getSceneSnapshotTool(worldService);
    expect(tool.name).toBe('getSceneSnapshot');
    expect(tool.description).toContain('snapshot');
    expect(tool.schema).toBe(getSceneSnapshotSchema);
  });

  it('deve invocar getSceneSnapshotTool e retornar payload SceneSnapshot íntegro e tipado', async () => {
    const tool = getSceneSnapshotTool(worldService);

    const snapshot = await tool.invoke({
      scenarioId: testScenarioId,
      includeMemories: false,
    });

    expect(snapshot).toBeDefined();
    expect(snapshot.scenarioId).toBe(testScenarioId);
    expect(snapshot.weather).toBe('clear');
    expect(snapshot.timeOfDay).toBe(14);
    expect(Array.isArray(snapshot.citizens)).toBe(true);
    expect(Array.isArray(snapshot.objects)).toBe(true);
  });

  it('deve refletir mudanças de ambiente dinâmicas no snapshot retornado', async () => {
    const tool = getSceneSnapshotTool(worldService);

    // Altera o clima e horário para tempestade noturna
    await worldService.setWeather(testScenarioId, 'storm', 45, 0.9, 21);

    const updatedSnapshot = await tool.invoke({
      scenarioId: testScenarioId,
      includeMemories: true,
    });

    expect(updatedSnapshot.scenarioId).toBe(testScenarioId);
    expect(updatedSnapshot.weather).toBe('storm');
    expect(updatedSnapshot.timeOfDay).toBe(21);
  });

  it('deve rejeitar invocações com parâmetros inválidos no schema Zod', () => {
    expect(() =>
      getSceneSnapshotSchema.parse({
        scenarioId: 'uuid-invalido',
      }),
    ).toThrow();
  });
});
