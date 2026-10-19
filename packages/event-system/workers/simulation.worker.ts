/**
 * @cidade-virtual/event-system - workers/simulation.worker.ts
 * Worker BullMQ para processamento determinístico do loop de simulação e física server-side.
 * Task-007: Consome simulation:queue, executa ticks de mundo, valida movimentação e despacha para DLQ.
 */
import { Worker, Job, ConnectionOptions } from 'bullmq';
import {
  SIMULATION_QUEUE_NAME,
  SimulationJobPayload,
  SystemQueues,
  getRedisConnectionOptions,
} from '../queues';
import { defaultLogger, metrics } from '@cidade-virtual/observability';

export interface MovementValidationRequest {
  agentId: string;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
}

export interface MovementValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ISimulationProcessor {
  processTick(tick: number, deltaMs: number): Promise<{ tickCount: number; durationMs?: number }>;
  validateMovement?(movement: MovementValidationRequest): Promise<MovementValidationResult>;
}

export interface SimulationWorkerOptions {
  connection?: ConnectionOptions;
  concurrency?: number;
}

export interface SimulationJobResult {
  tick: number;
  tickCount: number;
  durationMs: number;
  movementValidation?: MovementValidationResult;
}

export class SimulationWorker {
  private worker: Worker<SimulationJobPayload, SimulationJobResult>;
  private processorService: ISimulationProcessor;
  private queues: SystemQueues;

  constructor(
    processorService: ISimulationProcessor,
    options: SimulationWorkerOptions = {},
  ) {
    this.processorService = processorService;
    const connection = options.connection ?? getRedisConnectionOptions();
    this.queues = new SystemQueues(connection);

    this.worker = new Worker<SimulationJobPayload, SimulationJobResult>(
      SIMULATION_QUEUE_NAME,
      async (job: Job<SimulationJobPayload>) => {
        return this.handleJob(job);
      },
      {
        connection,
        concurrency: options.concurrency ?? 10,
      },
    );

    this.setupListeners();
  }

  private async handleJob(job: Job<SimulationJobPayload>): Promise<SimulationJobResult> {
    const startTime = Date.now();
    const { tick, deltaMs, validateMovement, enqueuedAt } = job.data;

    // 1. Registra tempo de espera na fila
    SystemQueues.recordWaitTime(enqueuedAt);

    defaultLogger.debug('Iniciando processamento de tick de simulação via worker', {
      jobId: job.id,
      tick,
      deltaMs,
    });

    try {
      // 2. Validação server-side de colisão/movimento se requisitada
      let movementValidation: MovementValidationResult | undefined;
      if (validateMovement && this.processorService.validateMovement) {
        movementValidation = await this.processorService.validateMovement(validateMovement);
        if (!movementValidation.valid) {
          metrics.increment('simulation.movement.rejected', 1);
          defaultLogger.warn('[AUDIT] [PHYSICS_VIOLATION] Movimento de avatar rejeitado pelo simulation-worker', {
            agentId: validateMovement.agentId,
            from: validateMovement.from,
            to: validateMovement.to,
            reason: movementValidation.reason,
          });
        }
      }

      // 3. Executa o tick de simulação
      const tickResult = await this.processorService.processTick(tick, deltaMs);
      const durationMs = Date.now() - startTime;

      metrics.recordDuration('simulation.tick.ms', durationMs);
      metrics.increment('simulation.ticks.processed', 1);

      defaultLogger.debug('Tick de simulação processado com sucesso', {
        jobId: job.id,
        tick,
        tickCount: tickResult.tickCount,
        durationMs,
      });

      return {
        tick,
        tickCount: tickResult.tickCount,
        durationMs,
        movementValidation,
      };
    } catch (error) {
      metrics.increment('simulation.cycle.errors', 1);
      defaultLogger.error('Erro crítico no processamento de tick de simulação', error, {
        jobId: job.id,
        tick,
      });
      throw error;
    }
  }

  private setupListeners(): void {
    this.worker.on('completed', (job: Job) => {
      defaultLogger.debug(`Job ${job.id} de simulação finalizado com sucesso`, { jobId: job.id });
    });

    this.worker.on('failed', async (job: Job | undefined, err: Error) => {
      defaultLogger.error(`Job ${job?.id} de simulação falhou: ${err.message}`, err, {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      });

      if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
        try {
          await this.queues.sendToDLQ({
            queueName: SIMULATION_QUEUE_NAME,
            failedReason: err.message,
            attemptsMade: job.attemptsMade,
            data: job.data,
          });
        } catch (dlqErr) {
          defaultLogger.error('Falha crítica ao enviar job de simulação para DLQ', dlqErr);
        }
      }
    });

    this.worker.on('error', (err: Error) => {
      defaultLogger.error('Erro de conexão ou infraestrutura no SimulationWorker', err);
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
