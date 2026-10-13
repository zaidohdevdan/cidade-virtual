import type { MemorySnippet } from '@cidade-virtual/types';

export class MemoryService {
  /**
   * Consulta memórias recentes de um NPC.
   */
  async queryByCitizen(
    _npcId: string,
    _timeframeHours: number,
    _limit: number
  ): Promise<MemorySnippet[]> {
    // TODO: recuperar memórias recentes do NPC via Qdrant
    return [];
  }
}
