import type { AgentExperience } from '@cidade-virtual/types';

export class ExperienceEvaluator {
  evaluatePredictionError(expected: string, observed: string): number {
    return expected === observed ? 0 : 0.8;
  }
}

export class MemoryConsolidationWorker {
  async consolidateExperiences(experiences: AgentExperience[]): Promise<{ consolidatedCount: number }> {
    return { consolidatedCount: experiences.length };
  }
}
