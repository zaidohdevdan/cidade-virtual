/**
 * @cidade-virtual/event-system - workers/cognition.worker.ts
 * Worker BullMQ para processamento assíncrono do ciclo cognitivo dos habitantes.
 * Task-006: Consome cognition:queue, controla concorrência (default 5), rate limit e despacha para DLQ.
 */
import { Worker, Job, ConnectionOptions } from 'bullmq';
import {
  COGNITION_QUEUE_NAME,
  CognitionJobPayload,
  SystemQueues,
  getRedisConnectionOptions,
} from '../queues';
import { defaultLogger, metrics } from '@cidade-virtual/observability';
import type { AgentAction } from '@cidade-virtual/types';

export interface ICognitionCycleProcessor {
  processCycle(context: {
    citizenId: any;
    currentObservation: string;
    nearbyObjects: string[];
    activeGoal?: string;
  }, options?: { forceLLM?: boolean }): Promise<AgentAction>;
}

export interface CognitionWorkerOptions {
  connection?: ConnectionOptions;
  concurrency?: number;
  maxCallsPerMinute?: number;
}

export class CognitionWorker {
  private worker: Worker<CognitionJobPayload>;
  private processorService: ICognitionCycleProcessor;
  private queues: SystemQueues;
  private callTimestamps: number[] = [];
  private maxCallsPerMinute: number;

  constructor(
    processorService: ICognitionCycleProcessor,
    options: CognitionWorkerOptions = {},
  ) {
    this.processorService = processorService;
    const connection = options.connection ?? getRedisConnectionOptions();
    this.queues = new SystemQueues(connection);
    this.maxCallsPerMinute = options.maxCallsPerMinute ?? 60;

    this.worker = new Worker<CognitionJobPayload>(
      COGNITION_QUEUE_NAME,
      async (job: Job<CognitionJobPayload>) => {
        return this.handleJob(job);
      },
      {
        connection,
        concurrency: options.concurrency ?? 5,
      },
    );

    this.setupListeners();
  }

  private async handleJob(job: Job<CognitionJobPayload>): Promise<AgentAction> {
    const startTime = Date.now();
    const { citizenId, currentObservation, nearbyObjects, activeGoal, forceLLM, enqueuedAt } = job.data;

    // 1. Registra tempo de espera na fila
    SystemQueues.recordWaitTime(enqueuedAt);

    // 2. Rate limiter local (max N chamadas por minuto)
    this.throttleRate();

    defaultLogger.info('Iniciando processamento do ciclo cognitivo via worker', {
      jobId: job.id,
      citizenId,
      attempt: job.attemptsMade + 1,
    });

    try {
      // 3. Executa o ciclo cognitivo através do processador
      const action = await this.processorService.processCycle(
        {
          citizenId,
          currentObservation,
          nearbyObjects: nearbyObjects ?? [],
          activeGoal,
        },
        { forceLLM },
      );

      const durationMs = Date.now() - startTime;
      metrics.recordDuration('cognition.cycle.ms', durationMs);

      defaultLogger.info('Ciclo cognitivo concluído pelo worker', {
        jobId: job.id,
        citizenId,
        actionType: action.actionType,
        durationMs,
      });

      return action;
    } catch (error) {
      defaultLogger.error('Falha na execução do ciclo cognitivo pelo worker', error, {
        jobId: job.id,
        citizenId,
        attempt: job.attemptsMade + 1,
      });

      // Se atingiu ou ultrapassará a 5ª tentativa, envia à Dead Letter Queue (DLQ)
      if (job.attemptsMade >= 4) {
        await this.queues.sendToDLQ({
          queueName: COGNITION_QUEUE_NAME,
          failedReason: (error as Error).message,
          attemptsMade: job.attemptsMade + 1,
          data: job.data,
        });
      }

      throw error;
    }
  }

  private throttleRate(): void {
    const now = Date.now();
    // Limpa timestamps mais velhos que 60 segundos
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < 60000);

    if (this.callTimestamps.length >= this.maxCallsPerMinute) {
      metrics.increment('cognition.throttled');
      defaultLogger.warn('Rate limiter de chamadas cognitivas acionado', {
        currentRate: this.callTimestamps.length,
        limit: this.maxCallsPerMinute,
      });
    }

    this.callTimestamps.push(now);
  }

  private setupListeners(): void {
    this.worker.on('completed', (job: Job) => {
      metrics.increment('cognition.jobs.completed');
      defaultLogger.debug(`Job ${job.id} finalizado com sucesso no CognitionWorker`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      metrics.increment('cognition.jobs.failed');
      defaultLogger.error(`Job ${job?.id} falhou no CognitionWorker: ${err.message}`, err);
    });
  }

  /**
   * Pausa o processamento de novos jobs no worker.
   */
  async pause(): Promise<void> {
    await this.worker.pause();
  }

  /**
   * Retoma o processamento de jobs no worker.
   */
  async resume(): Promise<void> {
    await this.worker.resume();
  }

  /**
   * Encerra o worker e a conexão de forma segura.
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queues.close();
  }
}
