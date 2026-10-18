import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  SystemQueues,
  COGNITION_QUEUE_NAME,
  SIMULATION_QUEUE_NAME,
  LEARNING_QUEUE_NAME,
  DLQ_QUEUE_NAME,
  getRedisConnectionOptions,
} from '@cidade-virtual/event-system';
import type { CitizenId } from '@cidade-virtual/types';
import { metrics } from '@cidade-virtual/observability';
import IORedis from 'ioredis';

describe('Task-005 — BullMQ Queues sobre Redis 7 Real', () => {
  let queues: SystemQueues;
  let redisClient: IORedis;

  beforeAll(async () => {
    const conn = getRedisConnectionOptions();
    redisClient = new IORedis(conn);

    // Garante que o Redis está respondendo
    const pingRes = await redisClient.ping();
    expect(pingRes).toBe('PONG');

    queues = new SystemQueues(conn);
  });

  afterAll(async () => {
    if (queues) {
      await queues.close();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  });

  it('deve inicializar as 3 filas e a DLQ com nomes corretos', () => {
    expect(queues.cognitionQueue.name).toBe(COGNITION_QUEUE_NAME);
    expect(queues.simulationQueue.name).toBe(SIMULATION_QUEUE_NAME);
    expect(queues.learningQueue.name).toBe(LEARNING_QUEUE_NAME);
    expect(queues.dlqQueue.name).toBe(DLQ_QUEUE_NAME);
  });

  it('deve enfileirar job de cognição com opções padrão e ler do Redis', async () => {
    const citizenId = 'citizen-queue-test-1' as CitizenId;
    const job = await queues.enqueueCognition({
      citizenId,
      currentObservation: 'Observando tráfego na esquina da Rua Central',
      nearbyObjects: ['semaforo-1', 'faixa-pedestres'],
      activeGoal: 'atravessar com segurança',
    });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.data.citizenId).toBe(citizenId);
    expect(job.data.enqueuedAt).toBeTypeOf('number');

    const retrievedJob = await queues.cognitionQueue.getJob(job.id!);
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.data.citizenId).toBe(citizenId);
  });

  it('deve enfileirar jobs de simulação e aprendizagem', async () => {
    const simJob = await queues.enqueueSimulation({
      tick: 42,
      deltaMs: 50,
    });
    expect(simJob.id).toBeDefined();

    const learnJob = await queues.enqueueLearning({
      agentId: 'citizen-learn-1' as CitizenId,
      lookbackMinutes: 60,
    });
    expect(learnJob.id).toBeDefined();
  });

  it('deve registrar tempo de espera na fila no MetricsCollector', () => {
    const fakeEnqueuedAt = Date.now() - 150;
    const recorded = SystemQueues.recordWaitTime(fakeEnqueuedAt);
    expect(recorded).toBeGreaterThanOrEqual(140);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.averages['queue.wait.time.ms']).toBeDefined();
    expect(snapshot.averages['queue.wait.time.ms']).toBeGreaterThanOrEqual(140);
  });

  it('deve despachar job falho para a Dead Letter Queue (DLQ)', async () => {
    const dlqJob = await queues.sendToDLQ({
      queueName: COGNITION_QUEUE_NAME,
      failedReason: 'Max retries (5) exceeded - cognitive cycle timeout',
      attemptsMade: 5,
      data: { citizenId: 'citizen-failed-1' },
    });

    expect(dlqJob).toBeDefined();
    expect(dlqJob.id).toBeDefined();

    const retrieved = await queues.dlqQueue.getJob(dlqJob.id!);
    expect(retrieved).toBeDefined();
    expect(retrieved?.data.originalQueue).toBe(COGNITION_QUEUE_NAME);
    expect(retrieved?.data.attemptsMade).toBe(5);
    expect(retrieved?.data.failedReason).toContain('Max retries');
  });
});
