import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QueueEvents } from 'bullmq';
import {
  SystemQueues,
  CognitionWorker,
  COGNITION_QUEUE_NAME,
  getRedisConnectionOptions,
} from '@cidade-virtual/event-system';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
} from '@cidade-virtual/persistence';
import { CognitionService } from '../../apps/api/src/modules/cognition/cognition.service';
import { MemoryService } from '../../apps/api/src/modules/memory/memory.service';
import type { CitizenId } from '@cidade-virtual/types';
import { metrics } from '@cidade-virtual/observability';

describe('Task-006 — CognitionWorker com BullMQ, Redis 7 e PostgreSQL Reais', () => {
  let queues: SystemQueues;
  let queueEvents: QueueEvents;
  let worker: CognitionWorker;
  let cognitionService: CognitionService;
  let expRepo: ExperienceRepository;
  let agentRepo: AgentIdentityRepository;
  let dbConn: ReturnType<typeof createDatabaseConnection>;
  let testCitizenId: CitizenId;

  beforeAll(async () => {
    // 1. Conexão real com PostgreSQL
    dbConn = createDatabaseConnection();
    expRepo = new ExperienceRepository(dbConn.db);
    agentRepo = new AgentIdentityRepository(dbConn.db);

    // Cria habitante de teste no PostgreSQL
    testCitizenId = crypto.randomUUID() as CitizenId;
    await agentRepo.upsert({
      id: testCitizenId,
      name: 'Worker Test Citizen',
      archetype: 'citizen',
      profileData: { backstorySeed: 'Habitante para testes assíncronos de worker' },
      activeGoals: ['navegação segura'],
      preferences: {},
      currentLocation: { x: 10, y: 0, z: 5 },
      emotionState: 'calm',
    });

    // 2. Serviço de Cognição com MemoryService real (Qdrant)
    const memoryService = new MemoryService();
    cognitionService = new CognitionService(memoryService, expRepo);

    // 3. Filas e Eventos BullMQ no Redis real
    const redisConn = getRedisConnectionOptions();
    queues = new SystemQueues(redisConn);
    queueEvents = new QueueEvents(COGNITION_QUEUE_NAME, { connection: redisConn });
    await queueEvents.waitUntilReady();

    // 4. Instanciação do CognitionWorker com concorrência 5
    worker = new CognitionWorker(cognitionService, {
      connection: redisConn,
      concurrency: 5,
      maxCallsPerMinute: 60,
    });
  });

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }
    if (queueEvents) {
      await queueEvents.close();
    }
    if (queues) {
      await queues.close();
    }
  });

  it('deve processar job de ciclo cognitivo assincronamente e persistir action_result no PostgreSQL', async () => {
    const job = await queues.enqueueCognition({
      citizenId: testCitizenId,
      currentObservation: 'Caminhando em direção à faixa enquanto o trânsito flui',
      nearbyObjects: ['faixa-central', 'placa-pare'],
      activeGoal: 'atravessar a rua',
    });

    expect(job.id).toBeDefined();

    // Aguarda o término da execução do job pelo worker
    const result = await job.waitUntilFinished(queueEvents, 5000);
    expect(result).toBeDefined();
    expect(result.agentId).toBe(testCitizenId);
    expect(result.actionType).toBeDefined();

    // Valida que o resultado foi gravado no PostgreSQL real
    const experiences = await expRepo.getByAgentId(testCitizenId, 5);
    expect(experiences.length).toBeGreaterThan(0);

    const actionExp = experiences.find((e) => e.sourceType === 'action_result');
    expect(actionExp).toBeDefined();
    expect(actionExp?.agentId).toBe(testCitizenId);
    expect(actionExp?.description).toContain('Ação deliberada');
  });

  it('deve processar múltiplos jobs concorrentes com latência < 2s', async () => {
    const startTime = Date.now();

    const jobs = await Promise.all([
      queues.enqueueCognition({
        citizenId: testCitizenId,
        currentObservation: 'Caminhando pela calçada norte',
        nearbyObjects: ['poste-1'],
      }),
      queues.enqueueCognition({
        citizenId: testCitizenId,
        currentObservation: 'Aguardando pedestres passarem na calçada sul',
        nearbyObjects: ['arvore-1'],
      }),
      queues.enqueueCognition({
        citizenId: testCitizenId,
        currentObservation: 'Caminhando em direção ao quiosque',
        nearbyObjects: ['quiosque-1'],
      }),
    ]);

    const results = await Promise.all(
      jobs.map((j) => j.waitUntilFinished(queueEvents, 5000)),
    );

    const totalDuration = Date.now() - startTime;
    expect(results.length).toBe(3);

    // Média por job sob concorrência < 2000ms
    const avgLatency = totalDuration / 3;
    expect(avgLatency).toBeLessThan(2000);

    // Verifica que métrica cognition.cycle.ms foi alimentada
    const snapshot = metrics.getSnapshot();
    expect(snapshot.averages['cognition.cycle.ms']).toBeDefined();
    expect(snapshot.averages['cognition.cycle.ms']).toBeLessThan(2000);
  });
});
