import type { CitizenId, CitizenArchetype, EmotionState } from '@cidade-virtual/types';

export interface AgentProfile {
  id: CitizenId;
  name: string;
  archetype: CitizenArchetype;
  goals: string[];
  preferences: Record<string, unknown>;
  emotion: EmotionState;
}

export class AgentIdentityService {
  private profiles = new Map<string, AgentProfile>();

  register(profile: AgentProfile): void {
    this.profiles.set(profile.id, profile);
  }

  get(id: CitizenId): AgentProfile | undefined {
    return this.profiles.get(id);
  }
}
