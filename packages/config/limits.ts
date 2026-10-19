// packages/config/limits.ts

export const OPERATIONAL_LIMITS = {
  // Rate limits
  maxToolCallsPerMinute: 100,
  maxLLMCallsPerMinute: 60,
  maxNPCsCreatedPerSession: 50,
  maxHttpRequestsPerMinute: 120, // Rate limit de requisições HTTP por IP
  maxSocketMessagesPerSecond: 30, // Rate limit de mensagens WebSocket por socket
  maxAvatarSpeedMps: 15, // Velocidade máxima tolerada do avatar (15 m/s)

  // Cost limits
  maxDailyCostUSD: 50,
  alertThresholdCostUSD: 40, // 80% do limite

  // Tool-specific
  weatherMaxDurationMinutes: 60,
  weatherMaxIntensity: 0.5,
  eventMaxSeverity: 'medium' as const,
  alertMaxSeverity: 'info' as const,

  // Timeouts
  toolCallTimeoutMs: 30_000,
  llmCallTimeoutMs: 60_000,
  qdrantQueryTimeoutMs: 5_000,

  // Agent reflection
  maxAgentIterations: 5,
  backoffBaseMs: 1_000,
  backoffMaxMs: 8_000,

  // Memory
  memoryTopKDefault: 10,
  memoryTimeframeHoursDefault: 168, // 1 semana
  memoryDecayHalfLifeDays: 30,
  memoryMaxPerNPC: 10_000, // acima disso, pruning automático com LLM
} as const;

export type OperationalLimit = typeof OPERATIONAL_LIMITS;
