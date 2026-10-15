import type { CitizenId } from '@cidade-virtual/types';

export interface SocialRelationship {
  sourceAgentId: CitizenId;
  targetAgentId: CitizenId;
  trustLevel: number; // 0..1
  interactionsCount: number;
  sharedExperiences: string[];
}

export class RelationshipManager {
  private relationships = new Map<string, SocialRelationship>();

  recordInteraction(source: CitizenId, target: CitizenId, positive: boolean): void {
    const key = `${source}:${target}`;
    const rel = this.relationships.get(key) ?? {
      sourceAgentId: source,
      targetAgentId: target,
      trustLevel: 0.5,
      interactionsCount: 0,
      sharedExperiences: [],
    };
    rel.interactionsCount++;
    rel.trustLevel = Math.max(0, Math.min(1, rel.trustLevel + (positive ? 0.05 : -0.1)));
    this.relationships.set(key, rel);
  }
}
