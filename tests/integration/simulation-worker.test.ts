import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QueueEvents } from 'bullmq';
import {
  SystemQueues,
  SimulationWorker,
  SIMULATION_QUEUE_NAME,
  DLQ_QUEUE_NAME,
  getRedisConnectionOptions,
  ISimulationProcessor,
} from '@cidade-virtual/event-system';
import {
  createDatabaseConnection,
  WorldStateRepository,
} from '@cidade-virtual/persistence';
import { metrics } from '@cidade-virtual/observability';

describe('Task-007 — SimulationWorker com BullMQ, Redis 7 e Validação Server-Side Reais', () => {
  let queues: SystemQueues;
  let queueEvents: QueueEvents;
  let dlqEvents: QueueEvents;
  let worker: SimulationWorker;
  let worldRepo: WorldStateRepository;
  let dbConn: ReturnType<typeof createDatabaseConnection>;
  const testWorldId = `world-sim-${Date.now()}`;

  beforeAll(async () => {
    // 1. Conexão real com PostgreSQL
    dbConn = createDatabaseConnection();
    worldRepo = new WorldStateRepository(dbConn.db);

    // Inicializa o estado do mundo para simulação
    await worldRepo.upsert({
      id: testWorldId,
      name: 'Mundo de Simulação Teste',
      tickCount: 100,
      timeOfDay: 12,
      weather: 'clear',
    });

    // 2. Filas e Eventos BullMQ no Redis real
    const redisConn = getRedisConnectionOptions();
    queues = new SystemQueues(redisConn);
    queueEvents = new QueueEvents(SIMULATION_QUEUE_NAME, { connection: redisConn });
    dlqEvents = new QueueEvents(DLQ_QUEUE_NAME, { connection: redisConn });
    await queueEvents.waitUntilReady();
    await dlqEvents.waitUntilReady();

    // 3. Processador determinístico de simulação física
    const simulationProcessor: ISimulationProcessor = {
      processTick: async (tick: number, deltaMs: number) => {
        const updated = await worldRepo.incrementTick(testWorldId, 1);
        return {
          tickCount: updated?.tickCount ?? tick,
          durationMs: deltaMs,
        };
      },
      validateMovement: async (mov) => {
        // Regra física server-side: rejeita saltos anômalos de velocidade (speed hack / teleporte > 10m por tick)
        const dx = mov.to.x - mov.from.x;
        const dz = mov.to.z - mov.from.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 10.0) {
          return { valid: false, reason: `Deslocamento anômalo detectado: ${dist.toFixed(2)}m em 1 tick` };
        }
        return { valid: true };
      },
    };

    // 4. Instanciação do SimulationWorker
    worker = new SimulationWorker(simulationProcessor, {
      connection: redisConn,
      concurrency: 5,
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

  it('deve processar job de tick de simulação assincronamente e avançar world_state no PostgreSQL', async () => {
    const job = await queues.enqueueSimulation({
      tick: 101,
      deltaMs: 50,
    });

    expect(job.id).toBeDefined();

    // Aguarda o término da execução do job pelo worker
    const result = await job.waitUntilFinished(queueEvents, 5000);
    expect(result).toBeDefined();
    expect(result.tick).toBe(101);
    expect(result.tickCount).toBeGreaterThanOrEqual(101);
    expect(result.durationMs).toBeDefined();

    // Valida persistência no PostgreSQL
    const state = await worldRepo.getById(testWorldId);
    expect(state).toBeDefined();
    expect(state?.tickCount).toBeGreaterThanOrEqual(101);

    // Valida registro de métrica
    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters['simulation.ticks.processed']).toBeGreaterThanOrEqual(1);
  });

  it('deve validar e aprovar movimentação legítima de avatar durante o ciclo de simulação', async () => {
    const job = await queues.enqueueSimulation({
      tick: 102,
      deltaMs: 50,
      validateMovement: {
        agentId: 'citizen-vega',
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0.2, y: 0, z: 0.3 }, // Deslocamento suave de 0.36m
      },
    });

    const result = await job.waitUntilFinished(queueEvents, 5000);
    expect(result.movementValidation).toBeDefined();
    expect(result.movementValidation?.valid).toBe(true);
  });

  it('deve rejeitar movimentação com teletransporte forjado (anti-speedhack / autoridade server-side)', async () => {
    const job = await queues.enqueueSimulation({
      tick: 103,
      deltaMs: 50,
      validateMovement: {
        agentId: 'citizen-exploiter',
        from: { x: 0, y: 0, z: 0 },
        to: { x: 80, y: 0, z: 120 }, // Salto anômalo de 144 metros
      },
    });

    const result = await job.waitUntilFinished(queueEvents, 5000);
    expect(result.movementValidation).toBeDefined();
    expect(result.movementValidation?.valid).toBe(false);
    expect(result.movementValidation?.reason).toContain('Deslocamento anômalo detectado');

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters['simulation.movement.rejected']).toBeGreaterThanOrEqual(1);
  });

  it('deve despachar job de simulação com falha crítica para a DLQ após esgotar tentativas', async () => {
    // Cria um worker de simulação temporário que sempre falha para testar a resiliência da DLQ
    const redisConn = getRedisConnectionOptions();
    const failingProcessor: ISimulationProcessor = {
      processTick: async () => {
        throw new Error('Falha catastrófica no motor de física da simulação');
      },
    };

    await worker.pause();
    const failingWorker = new SimulationWorker(failingProcessor, {
      connection: redisConn,
      concurrency: 1,
    });

    try {
      const failingJob = await queues.simulationQueue.add(
        'failing-tick',
        { tick: 999, deltaMs: 50, enqueuedAt: Date.now() },
        { attempts: 1, removeOnFail: false }
      );

      // Aguarda rejeição do job
      await expect(failingJob.waitUntilFinished(queueEvents, 5000)).rejects.toThrow();

      // Aguarda encaminhamento para a DLQ
      let dlqFound = false;
      for (let i = 0; i < 20; i++) {
        const dlqJobs = await queues.dlqQueue.getJobs(['waiting', 'completed']);
        const match = dlqJobs.find((j) => (j.data as any).originalQueue === SIMULATION_QUEUE_NAME);
        if (match) {
          dlqFound = true;
          expect((match.data as any).failedReason).toContain('Falha catastrófica no motor de física');
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
