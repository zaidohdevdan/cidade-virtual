import type { CitizenId } from '@cidade-virtual/types';

export interface Observation {
  agentId: CitizenId;
  description: string;
  observedEntities: string[];
  timestamp: string;
}

export class PerceptionService {
  buildObservation(agentId: CitizenId, description: string, entities: string[] = []): Observation {
    return {
      agentId,
      description,
      observedEntities: entities,
      timestamp: new Date().toISOString(),
    };
  }
}
