/**
 * @cidade-virtual/event-system - queues.ts
 * Configuração e gerenciamento de filas assíncronas BullMQ sobre Redis 7.
 * Task-005: 3 filas (simulation, cognition, learning) + DLQ + retries exponenciais + métricas.
 */
import { Queue, QueueOptions, JobsOptions, ConnectionOptions } from 'bullmq';
import type { CitizenId } from '@cidade-virtual/types';
import { metrics, defaultLogger } from '@cidade-virtual/observability';

export const SIMULATION_QUEUE_NAME = 'simulation-queue';
export const COGNITION_QUEUE_NAME = 'cognition-queue';
export const LEARNING_QUEUE_NAME = 'learning-queue';
export const DLQ_QUEUE_NAME = 'dlq-queue';

export interface CognitionJobPayload {
  citizenId: CitizenId;
  currentObservation: string;
  nearbyObjects?: string[];
  activeGoal?: string;
  forceLLM?: boolean;
  enqueuedAt?: number;
}

export interface SimulationJobPayload {
  tick: number;
  deltaMs: number;
  enqueuedAt?: number;
}

export interface LearningJobPayload {
  agentId?: CitizenId;
  lookbackMinutes?: number;
  enqueuedAt?: number;
}

export interface DLQJobPayload {
  originalQueue: string;
  failedReason: string;
  attemptsMade: number;
  payload: unknown;
  timestamp: string;
}

/**
 * Opções de conexão com Redis compartilhadas entre filas e workers.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null, // Obrigatório pelo BullMQ
  };
}

/**
 * Opções padrão de jobs com retries exponenciais (1s base até ~8s).
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 1000,
  removeOnFail: false, // Mantém falhas para inspeção e DLQ
};

export class SystemQueues {
  public readonly cognitionQueue: Queue<CognitionJobPayload>;
  public readonly simulationQueue: Queue<SimulationJobPayload>;
  public readonly learningQueue: Queue<LearningJobPayload>;
  public readonly dlqQueue: Queue<DLQJobPayload>;

  constructor(connectionOptions: ConnectionOptions = getRedisConnectionOptions()) {
    const queueOpts: QueueOptions = {
      connection: connectionOptions,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    };

    this.cognitionQueue = new Queue<CognitionJobPayload>(COGNITION_QUEUE_NAME, queueOpts);
    this.simulationQueue = new Queue<SimulationJobPayload>(SIMULATION_QUEUE_NAME, queueOpts);
    this.learningQueue = new Queue<LearningJobPayload>(LEARNING_QUEUE_NAME, queueOpts);
    this.dlqQueue = new Queue<DLQJobPayload>(DLQ_QUEUE_NAME, queueOpts);
  }

  /**
   * Enfileira ciclo cognitivo de habitante com rastreabilidade temporal.
   */
  async enqueueCognition(payload: CognitionJobPayload, customOptions?: JobsOptions) {
    const enqueuedPayload = {
      ...payload,
      enqueuedAt: Date.now(),
    };

    const job = await this.cognitionQueue.add('evaluate-cycle', enqueuedPayload, customOptions);
    defaultLogger.debug('Job de cognição enfileirado', {
      jobId: job.id,
      agentId: payload.citizenId,
    });
    return job;
  }

  /**
   * Enfileira job de simulação / tick do mundo.
   */
  async enqueueSimulation(payload: SimulationJobPayload, customOptions?: JobsOptions) {
    const enqueuedPayload = {
      ...payload,
      enqueuedAt: Date.now(),
    };

    return this.simulationQueue.add('world-tick', enqueuedPayload, customOptions);
  }

  /**
   * Enfileira job de consolidação de memórias.
   */
  async enqueueLearning(payload: LearningJobPayload, customOptions?: JobsOptions) {
    const enqueuedPayload = {
      ...payload,
      enqueuedAt: Date.now(),
    };

    return this.learningQueue.add('consolidate-experiences', enqueuedPayload, customOptions);
  }

  /**
   * Envia payload de job falho para a Dead Letter Queue (DLQ).
   */
  async sendToDLQ(failedJob: {
    queueName: string;
    failedReason: string;
    attemptsMade: number;
    data: unknown;
  }) {
    const dlqPayload: DLQJobPayload = {
      originalQueue: failedJob.queueName,
      failedReason: failedJob.failedReason,
      attemptsMade: failedJob.attemptsMade,
      payload: failedJob.data,
      timestamp: new Date().toISOString(),
    };

    defaultLogger.warn('Enviando job falho para Dead Letter Queue', {
      queue: failedJob.queueName,
      attempts: failedJob.attemptsMade,
      reason: failedJob.failedReason,
    });

    return this.dlqQueue.add('poison-pill', dlqPayload, {
      removeOnComplete: 5000,
    });
  }

  /**
   * Registra o tempo que um job esperou na fila antes de começar a ser executado.
   */
  static recordWaitTime(enqueuedAt?: number): number {
    if (!enqueuedAt) return 0;
    const waitTimeMs = Math.max(0, Date.now() - enqueuedAt);
    metrics.recordDuration('queue.wait.time.ms', waitTimeMs);
    return waitTimeMs;
  }

  /**
   * Fecha todas as conexões de fila graciosamente.
   */
  async close(): Promise<void> {
    await Promise.all([
      this.cognitionQueue.close(),
      this.simulationQueue.close(),
      this.learningQueue.close(),
      this.dlqQueue.close(),
    ]);
  }
}
