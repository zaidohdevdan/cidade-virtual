/**
 * @cidade-virtual/observability
 * Logging estruturado, rastreabilidade e auditoria cognitiva para o monorepo Synapse City.
 * Alinhado com SKILL.md v2.0.0 Seção 4 (Stack Tecnológica) e Seções 10/11 (Auditoria e Observabilidade).
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

export interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  context?: Record<string, unknown>;
  agentId?: string;
  traceId?: string;
  durationMs?: number;
}

export class StructuredLogger {
  private serviceName: string;

  constructor(serviceName: string = 'synapse-city') {
    this.serviceName = serviceName;
  }

  private emit(level: LogLevel, event: string, context?: Record<string, unknown>, extra?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      level,
      event,
      timestamp: new Date().toISOString(),
      context: { service: this.serviceName, ...context },
      ...extra,
    };

    const serialized = JSON.stringify(entry);
    if (level === 'ERROR') {
      console.error(serialized);
    } else if (level === 'WARN') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(event: string, context?: Record<string, unknown>): void {
    this.emit('DEBUG', event, context);
  }

  info(event: string, context?: Record<string, unknown>): void {
    this.emit('INFO', event, context);
  }

  warn(event: string, context?: Record<string, unknown>): void {
    this.emit('WARN', event, context);
  }

  error(event: string, error: unknown, context?: Record<string, unknown>): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { error: String(error) };
    this.emit('ERROR', event, { ...context, ...errorDetails });
  }

  audit(event: string, agentId: string, context?: Record<string, unknown>): void {
    this.emit('AUDIT', event, context, { agentId });
  }
}

/**
 * Registrador de auditoria cognitiva para decisões, percepções e memórias de agentes de IA.
 */
export class CognitiveAuditLogger {
  private logger: StructuredLogger;

  constructor(serviceName: string = 'cognition-audit') {
    this.logger = new StructuredLogger(serviceName);
  }

  logPerception(agentId: string, stimulus: unknown, emotionalImpact: number): void {
    this.logger.audit('AGENT_PERCEPTION', agentId, { stimulus, emotionalImpact });
  }

  logDecision(agentId: string, chosenAction: unknown, reasoning: string, confidence: number): void {
    this.logger.audit('AGENT_DECISION', agentId, { chosenAction, reasoning, confidence });
  }

  logMemoryStored(agentId: string, memoryType: string, summary: string): void {
    this.logger.audit('MEMORY_STORED', agentId, { memoryType, summary });
  }
}

/**
 * Coletor de métricas para monitoramento de latência e contadores do motor de simulação.
 */
export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number[]> = new Map();

  increment(metricName: string, delta: number = 1): void {
    const current = this.counters.get(metricName) ?? 0;
    this.counters.set(metricName, current + delta);
  }

  recordDuration(metricName: string, durationMs: number): void {
    const samples = this.timers.get(metricName) ?? [];
    samples.push(durationMs);
    if (samples.length > 500) samples.shift(); // Janela deslizante
    this.timers.set(metricName, samples);
  }

  getSnapshot(): { counters: Record<string, number>; averages: Record<string, number> } {
    const counters: Record<string, number> = {};
    this.counters.forEach((val, key) => (counters[key] = val));

    const averages: Record<string, number> = {};
    this.timers.forEach((samples, key) => {
      const sum = samples.reduce((a, b) => a + b, 0);
      averages[key] = samples.length ? Number((sum / samples.length).toFixed(2)) : 0;
    });

    return { counters, averages };
  }
}

export const defaultLogger = new StructuredLogger('global');
export const cognitiveAudit = new CognitiveAuditLogger();
export const metrics = new MetricsCollector();
