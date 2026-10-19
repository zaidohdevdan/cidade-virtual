import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QueueEvents } from 'bullmq';
import {
  SystemQueues,
  LearningWorker,
  LEARNING_QUEUE_NAME,
  DLQ_QUEUE_NAME,
  getRedisConnectionOptions,
  ILearningProcessor,
} from '@cidade-virtual/event-system';
import {
  createDatabaseConnection,
  AgentIdentityRepository,
  ExperienceRepository,
} from '@cidade-virtual/persistence';
import { MemoryService } from '@cidade-virtual/memory';
import { MemoryConsolidationWorker } from '@cidade-virtual/learning-system';
import type { CitizenId } from '@cidade-virtual/types';
import { metrics } from '@cidade-virtual/observability';

describe('Task-008 — LearningWorker com BullMQ, Redis 7, Qdrant e PostgreSQL Reais (Classe D)', () => {
  let queues: SystemQueues;
  let queueEvents: QueueEvents;
  let dlqEvents: QueueEvents;
  let worker: LearningWorker;
  let consolidationWorker: MemoryConsolidationWorker;
  let expRepo: ExperienceRepository;
  let agentRepo: AgentIdentityRepository;
  let memoryService: MemoryService;
  let dbConn: ReturnType<typeof createDatabaseConnection>;
  let testCitizenId: CitizenId;

  beforeAll(async () => {
    // 1. Conexão real com PostgreSQL
    dbConn = createDatabaseConnection();
    expRepo = new ExperienceRepository(dbConn.db);
    agentRepo = new AgentIdentityRepository(dbConn.db);

    // Cria habitante para teste de consolidação noturna
    testCitizenId = crypto.randomUUID() as CitizenId;
    await agentRepo.upsert({
      id: testCitizenId,
      name: 'Learning Worker Citizen',
      archetype: 'student',
      profileData: { backstorySeed: 'Habitante em processo contínuo de aprendizagem urbana' },
      activeGoals: ['compreender trânsito'],
      preferences: {},
      currentLocation: { x: 5, y: 0, z: -10 },
      emotionState: 'curious',
    });

    // 2. Serviço de memória vetorial real (Qdrant)
    memoryService = new MemoryService();

    // 3. Processador de consolidação de experiências
    consolidationWorker = new MemoryConsolidationWorker(expRepo, memoryService);

    // 4. Filas e Eventos BullMQ no Redis real
    const redisConn = getRedisConnectionOptions();
    queues = new SystemQueues(redisConn);
    queueEvents = new QueueEvents(LEARNING_QUEUE_NAME, { connection: redisConn });
    dlqEvents = new QueueEvents(DLQ_QUEUE_NAME, { connection: redisConn });
    await queueEvents.waitUntilReady();
    await dlqEvents.waitUntilReady();

    // 5. Instanciação do LearningWorker
    worker = new LearningWorker(consolidationWorker, {
      connection: redisConn,
      concurrency: 2,
    });
  });

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }
    if (queueEvents) {
      await queueEvents.close();
    }
    if (dlqEvents) {
      await dlqEvents.close();
    }
    if (queues) {
      await queues.close();
    }
  });

  it('deve processar job de consolidação e sintetizar memórias semânticas no Qdrant e PostgreSQL', async () => {
    // Registra 3 experiências episódicas para o habitante
    await expRepo.record({
      agentId: testCitizenId,
      eventType: 'traffic_light_observed',
      description: 'Observou semáforo mudando para verde antes da travessia',
      sourceType: 'direct_observation',
      confidence: '0.98',
      importance: '0.80',
    });

    await expRepo.record({
      agentId: testCitizenId,
      eventType: 'crosswalk_used',
      description: 'Atravessou na faixa de pedestres respeitando a sinalização',
      sourceType: 'direct_observation',
      confidence: '0.95',
      importance: '0.85',
    });

    await expRepo.record({
      agentId: testCitizenId,
      eventType: 'trash_bin_noted',
      description: 'Notou lixeira pública próxima e descartou resíduo corretamente',
      sourceType: 'direct_observation',
      confidence: '0.90',
      importance: '0.75',
    });

    // Enfileira job de aprendizagem na fila BullMQ
    const job = await queues.enqueueLearning({
      agentId: testCitizenId,
      lookbackMinutes: 120,
    });

    expect(job.id).toBeDefined();

    // Aguarda conclusão do job pelo worker
    const result = await job.waitUntilFinished(queueEvents, 8000);
    expect(result).toBeDefined();
    expect(result.consolidatedCount).toBeGreaterThanOrEqual(3);
    expect(result.semanticMemoriesCreated).toBeGreaterThanOrEqual(1);
    expect(result.agentsProcessed).toBe(1);

    // Valida que a memória semântica sintetizada foi persistida no Qdrant
    const memories = await memoryService.semanticQuery({
      citizenId: testCitizenId,
      queryText: 'travessia e convivência urbana',
      topK: 5,
    });

    expect(memories.length).toBeGreaterThanOrEqual(1);
    const semanticMem = memories.find((m) => m.memoryType === 'semantic');
    expect(semanticMem).toBeDefined();
    expect(semanticMem?.content).toContain('Síntese');

    // Valida que a reflexão foi gravada no PostgreSQL
    const allExps = await expRepo.getByAgentId(testCitizenId, 10);
    const consolidatedExp = allExps.find((e) => e.eventType === 'memory_consolidated');
    expect(consolidatedExp).toBeDefined();
    expect(consolidatedExp?.sourceType).toBe('inference');

    // Valida métricas do collector
    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters['learning.jobs.completed']).toBeGreaterThanOrEqual(1);
    expect(snapshot.counters['learning.experiences.consolidated']).toBeGreaterThanOrEqual(3);
  });

  it('deve podar episódios originais quando solicitado pruneOriginals: true', async () => {
    // Cria habitante para teste de poda
    const pruneCitizenId = crypto.randomUUID() as CitizenId;
    await agentRepo.upsert({
      id: pruneCitizenId,
      name: 'Prune Citizen',
      archetype: 'citizen',
      profileData: {},
      activeGoals: [],
      preferences: {},
      currentLocation: { x: 0, y: 0, z: 0 },
      emotionState: 'calm',
    });

    const exp1 = await expRepo.record({
      agentId: pruneCitizenId,
      eventType: 'walk_step',
      description: 'Passo episódico temporário na calçada',
      sourceType: 'direct_observation',
      confidence: '0.90',
      importance: '0.30',
    });

    const exp2 = await expRepo.record({
      agentId: pruneCitizenId,
      eventType: 'walk_step',
      description: 'Segundo passo episódico na calçada',
      sourceType: 'direct_observation',
      confidence: '0.90',
      importance: '0.30',
    });

    // Enfileira consolidação com poda ativa
    const job = await queues.enqueueLearning({
      agentId: pruneCitizenId,
      pruneOriginals: true,
      lookbackMinutes: 60,
    });

    const result = await job.waitUntilFinished(queueEvents, 8000);
    expect(result.consolidatedCount).toBe(2);

    // As experiências originais devem ter sido podadas do PostgreSQL
    const remaining = await expRepo.getByAgentId(pruneCitizenId, 10);
    const original1 = remaining.find((e) => e.id === exp1.id);
    const original2 = remaining.find((e) => e.id === exp2.id);
    expect(original1).toBeUndefined();
    expect(original2).toBeUndefined();

    // Apenas a experiência consolidada reflexiva deve permanecer
    const consolidated = remaining.find((e) => e.eventType === 'memory_consolidated');
    expect(consolidated).toBeDefined();
  });

  it('deve despachar job de aprendizagem com falha crítica para a DLQ após esgotar tentativas', async () => {
    const redisConn = getRedisConnectionOptions();
    const failingProcessor: ILearningProcessor = {
      consolidateExperiences: async () => {
        throw new Error('Falha catastrófica no Qdrant durante consolidação noturna');
      },
    };

    await worker.pause();
    const failingWorker = new LearningWorker(failingProcessor, {
      connection: redisConn,
      concurrency: 1,
    });

    try {
      const failingJob = await queues.learningQueue.add(
        'failing-learning',
        { agentId: testCitizenId, lookbackMinutes: 60, enqueuedAt: Date.now() },
        { attempts: 1, removeOnFail: false }
      );

      // Aguarda rejeição
      await expect(failingJob.waitUntilFinished(queueEvents, 5000)).rejects.toThrow();

      // Aguarda encaminhamento para a DLQ
      let dlqFound = false;
      for (let i = 0; i < 20; i++) {
        const dlqJobs = await queues.dlqQueue.getJobs(['waiting', 'completed']);
        const match = dlqJobs.find((j) => (j.data as any).originalQueue === LEARNING_QUEUE_NAME);
        if (match) {
          dlqFound = true;
          expect((match.data as any).failedReason).toContain('Falha catastrófica no Qdrant');
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(dlqFound).toBe(true);
    } finally {
      await failingWorker.close();
      await worker.resume();
    }
  });
});
