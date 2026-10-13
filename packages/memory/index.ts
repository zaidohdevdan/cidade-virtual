// packages/memory/index.ts
import type { CitizenId, MemorySnippet } from '@cidade-virtual/types';

export interface SemanticQueryOptions {
  citizenId: CitizenId;
  queryText: string;
  topK?: number;
  timeframeHours?: number;
  minEmotionalWeight?: number;
}

export class MemoryService {
  /**
   * Consulta memórias recentes por habitante no Qdrant
   */
  async queryByCitizen(
    _npcId: string,
    _timeframeHours: number,
    _limit: number
  ): Promise<MemorySnippet[]> {
    // TODO: consultar coleção de memórias do Qdrant
    return [];
  }

  /**
   * Consulta semântica de memórias vetoriais
   */
  async semanticQuery(_options: SemanticQueryOptions): Promise<MemorySnippet[]> {
    // TODO: gerar embedding da queryText e recuperar top-N vetores mais similares no Qdrant
    return [];
  }

  /**
   * Adiciona nova memória vetorial ao Qdrant
   */
  async addMemory(_memory: Omit<MemorySnippet, 'id'>): Promise<{ id: string }> {
    // TODO: gerar embedding e inserir documento vetorial
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  /**
   * Executa poda de memórias antigas ou consolidação com sumarização
   */
  async pruneMemory(_citizenId: CitizenId): Promise<void> {
    // TODO: podar memórias com decaimento exponencial
  }
}
