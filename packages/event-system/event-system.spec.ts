import { describe, it, expect } from 'vitest';
import {
  SIMULATION_QUEUE_NAME,
  COGNITION_QUEUE_NAME,
  LEARNING_QUEUE_NAME,
  DLQ_QUEUE_NAME,
  getRedisConnectionOptions,
  DEFAULT_JOB_OPTIONS,
} from './queues';

describe('packages/event-system — Queues & Events Unit Tests', () => {
  it('deve exportar os nomes padronizados das 4 filas do sistema', () => {
    expect(SIMULATION_QUEUE_NAME).toBe('simulation-queue');
    expect(COGNITION_QUEUE_NAME).toBe('cognition-queue');
    expect(LEARNING_QUEUE_NAME).toBe('learning-queue');
    expect(DLQ_QUEUE_NAME).toBe('dlq-queue');
  });

  it('deve fornecer opções de conexão Redis com fallback seguro e maxRetriesPerRequest nulo', () => {
    const opts = getRedisConnectionOptions();
    expect(opts).toBeDefined();
    expect(opts.host).toBeDefined();
    expect(opts.port).toBeGreaterThanOrEqual(1024);
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('deve configurar retry exponencial e remoção de jobs completados no DEFAULT_JOB_OPTIONS', () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_JOB_OPTIONS.backoff).toBeDefined();
    expect((DEFAULT_JOB_OPTIONS.backoff as any).type).toBe('exponential');
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toBeDefined();
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBeDefined();
  });
});
