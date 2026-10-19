import type { AgentExperience, CitizenId } from '@cidade-virtual/types';
import type { ExperienceRepository, AgentExperienceRow } from '@cidade-virtual/persistence';
import type { MemoryService } from '@cidade-virtual/memory';
import { defaultLogger, metrics } from '@cidade-virtual/observability';

export class ExperienceEvaluator {
  evaluatePredictionError(expected: string, observed: string): number {
    return expected === observed ? 0 : 0.8;
  }
}

export interface ConsolidationOptions {
  agentId?: string;
  lookbackMinutes?: number;
  pruneOriginals?: boolean;
  experiences?: AgentExperienceRow[] | AgentExperience[];
}

export interface ConsolidationResult {
  consolidatedCount: number;
  semanticMemoriesCreated: number;
  agentsProcessed: number;
  details: Array<{
    agentId: string;
    count: number;
    summary: string;
    semanticMemoryId?: string;
  }>;
}

/**
 * Worker de consolidação passiva de memórias (Classe D — Ciclo Noturno).
 * Task-008: Varre experiências recentes, sintetiza resumos semânticos no Qdrant
 * e arquiva episódios redundantes, registrando log de auditoria.
 */
export class MemoryConsolidationWorker {
  constructor(
    private readonly expRepo?: ExperienceRepository,
    private readonly memoryService?: MemoryService,
  ) {}

  async consolidateExperiences(options: ConsolidationOptions = {}): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const { agentId, lookbackMinutes = 1440, pruneOriginals = false } = options;

    // 1. Coleta experiências alvo
    let rawExperiences: (AgentExperienceRow | AgentExperience)[] = [];

    if (options.experiences && options.experiences.length > 0) {
      rawExperiences = options.experiences;
    } else if (this.expRepo) {
      if (agentId) {
        rawExperiences = await this.expRepo.getByAgentId(agentId, 100);
      } else {
        const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);
        rawExperiences = await this.expRepo.getByDateRange(since, 200);
      }
    }

    if (rawExperiences.length === 0) {
      return {
        consolidatedCount: 0,
        semanticMemoriesCreated: 0,
        agentsProcessed: 0,
        details: [],
      };
    }

    // 2. Agrupa experiências por habitante (agentId)
    const grouped = new Map<string, (AgentExperienceRow | AgentExperience)[]>();
    for (const exp of rawExperiences) {
      const list = grouped.get(exp.agentId) || [];
      list.push(exp);
      grouped.set(exp.agentId, list);
    }

    const details: ConsolidationResult['details'] = [];
    let totalConsolidated = 0;
    let totalSemanticCreated = 0;

    // 3. Processa cada grupo de experiências
    for (const [id, expList] of grouped.entries()) {
      if (expList.length === 0) continue;

      // Síntese semântica estruturada a partir das descrições dos episódios
      const descriptions = expList.map((e) => e.description).filter(Boolean);
      const uniqueThemes = Array.from(new Set(descriptions));
      const summaryText =
        descriptions.length === 1
          ? `Síntese de rotina do habitante: ${descriptions[0]}`
          : `Síntese consolidada de ${descriptions.length} experiências de rotina: ${uniqueThemes.slice(0, 4).join('; ')}`;

      let semanticMemoryId: string | undefined;

      // Persiste no Qdrant via MemoryService se disponível
      if (this.memoryService) {
        try {
          const stored = await this.memoryService.addMemory({
            citizenId: id as CitizenId,
            content: summaryText,
            timestamp: new Date(),
            memoryType: 'semantic',
            origin: 'reflection',
            sourceType: 'inference',
            sensoryTags: ['internal', 'social'],
            emotionalWeight: 0.85,
            confidence: 0.95,
          });
          semanticMemoryId = stored.id;
          totalSemanticCreated++;
        } catch (err) {
          defaultLogger.warn('Aviso: falha ao persistir memória semântica no Qdrant durante consolidação', {
            agentId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        // Modo fallback / mock
        semanticMemoryId = crypto.randomUUID();
        totalSemanticCreated++;
      }

      // Registra experiência reflexiva no banco relacional
      if (this.expRepo) {
        try {
          await this.expRepo.record({
            agentId: id,
            eventType: 'memory_consolidated',
            description: summaryText,
            sourceType: 'inference',
            confidence: '0.95',
            importance: '0.85',
            metadata: {
              consolidatedCount: expList.length,
              semanticMemoryId,
              pruned: pruneOriginals,
            },
          });
        } catch (err) {
          defaultLogger.warn('Aviso: falha ao registrar experiência consolidada no PostgreSQL', {
            agentId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // Poda os episódios originais se solicitado
        if (pruneOriginals) {
          const idsToPrune = expList.map((e) => e.id).filter(Boolean) as string[];
          if (idsToPrune.length > 0) {
            await this.expRepo.deleteByIds(idsToPrune);
          }
        }
      }

      totalConsolidated += expList.length;

      // Log estruturado de auditoria da consolidação
      defaultLogger.info('[AUDIT] [LEARNING_CONSOLIDATION] Experiências consolidadas em memória semântica', {
        agentId: id,
        consolidatedCount: expList.length,
        semanticMemoryId,
        summary: summaryText,
      });

      details.push({
        agentId: id,
        count: expList.length,
        summary: summaryText,
        semanticMemoryId,
      });
    }

    const durationMs = Date.now() - startTime;
    metrics.recordDuration('learning.consolidation.ms', durationMs);
    metrics.increment('learning.experiences.consolidated', totalConsolidated);
    metrics.increment('learning.semantic.created', totalSemanticCreated);

    return {
      consolidatedCount: totalConsolidated,
      semanticMemoriesCreated: totalSemanticCreated,
      agentsProcessed: grouped.size,
      details,
    };
  }
}
