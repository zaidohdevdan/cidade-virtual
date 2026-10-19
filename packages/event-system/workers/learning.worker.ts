/**
 * @cidade-virtual/event-system - workers/learning.worker.ts
 * Worker BullMQ para processamento assíncrono de consolidação de aprendizagem e memórias (Classe D).
 * Task-008: Consome learning:queue, executa consolidação noturna/periódica de experiências em memórias semânticas e despacha para DLQ.
 */
import { Worker, Job, ConnectionOptions } from 'bullmq';
import {
  LEARNING_QUEUE_NAME,
  LearningJobPayload,
  SystemQueues,
  getRedisConnectionOptions,
} from '../queues';
import { defaultLogger, metrics } from '@cidade-virtual/observability';
import type { ConsolidationOptions, ConsolidationResult } from '@cidade-virtual/learning-system';

export interface ILearningProcessor {
  consolidateExperiences(options?: ConsolidationOptions): Promise<ConsolidationResult>;
}

export interface LearningWorkerOptions {
  connection?: ConnectionOptions;
  concurrency?: number;
}

export class LearningWorker {
  private worker: Worker<LearningJobPayload, ConsolidationResult>;
  private processorService: ILearningProcessor;
  private queues: SystemQueues;

  constructor(
    processorService: ILearningProcessor,
    options: LearningWorkerOptions = {},
  ) {
    this.processorService = processorService;
    const connection = options.connection ?? getRedisConnectionOptions();
    this.queues = new SystemQueues(connection);

    this.worker = new Worker<LearningJobPayload, ConsolidationResult>(
      LEARNING_QUEUE_NAME,
      async (job: Job<LearningJobPayload>) => {
        return this.handleJob(job);
      },
      {
        connection,
        concurrency: options.concurrency ?? 2,
      },
    );

    this.setupListeners();
  }

  private async handleJob(job: Job<LearningJobPayload>): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const { agentId, lookbackMinutes, pruneOriginals, enqueuedAt } = job.data;

    // 1. Registra tempo de espera na fila
    SystemQueues.recordWaitTime(enqueuedAt);

    defaultLogger.info('Iniciando processamento de consolidação de aprendizagem via worker', {
      jobId: job.id,
      agentId,
      lookbackMinutes,
      pruneOriginals,
    });

    try {
      // 2. Executa consolidação de experiências através do processador
      const result = await this.processorService.consolidateExperiences({
        agentId,
        lookbackMinutes,
        pruneOriginals,
      });

      const durationMs = Date.now() - startTime;
      metrics.recordDuration('learning.job.duration.ms', durationMs);
      metrics.increment('learning.jobs.completed', 1);

      defaultLogger.info('Consolidação de aprendizagem concluída pelo worker', {
        jobId: job.id,
        consolidatedCount: result.consolidatedCount,
        semanticMemoriesCreated: result.semanticMemoriesCreated,
        agentsProcessed: result.agentsProcessed,
        durationMs,
      });

      return result;
    } catch (error) {
      metrics.increment('learning.job.errors', 1);
      defaultLogger.error('Erro crítico no processamento de consolidação de aprendizagem', error, {
        jobId: job.id,
        agentId,
      });
      throw error;
    }
  }

  private setupListeners(): void {
    this.worker.on('completed', (job: Job) => {
      defaultLogger.debug(`Job ${job.id} de aprendizagem finalizado com sucesso`, { jobId: job.id });
    });

    this.worker.on('failed', async (job: Job | undefined, err: Error) => {
      defaultLogger.error(`Job ${job?.id} de aprendizagem falhou: ${err.message}`, err, {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      });

      if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
        try {
          await this.queues.sendToDLQ({
            queueName: LEARNING_QUEUE_NAME,
            failedReason: err.message,
            attemptsMade: job.attemptsMade,
            data: job.data,
          });
        } catch (dlqErr) {
          defaultLogger.error('Falha crítica ao enviar job de aprendizagem para DLQ', dlqErr);
        }
      }
    });

    this.worker.on('error', (err: Error) => {
      defaultLogger.error('Erro de conexão ou infraestrutura no LearningWorker', err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queues.close();
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  async resume(): Promise<void> {
    this.worker.resume();
  }
}
