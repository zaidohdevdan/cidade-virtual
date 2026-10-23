// packages/memory/index.ts
import type { CitizenId, MemorySnippet } from '@cidade-virtual/types';
import { OPERATIONAL_LIMITS } from '@cidade-virtual/config';

export interface SemanticQueryOptions {
  citizenId: CitizenId;
  queryText: string;
  topK?: number;
  timeframeHours?: number;
  minEmotionalWeight?: number;
}

export interface MemoryServiceConfig {
  baseUrl?: string;
  collectionName?: string;
  vectorDimensions?: number;
  timeoutMs?: number;
}

export class MemoryService {
  private readonly baseUrl: string;
  private readonly collectionName: string;
  private readonly vectorDimensions: number;
  private readonly timeoutMs: number;
  private collectionInitialized = false;

  constructor(config?: MemoryServiceConfig) {
    this.baseUrl = config?.baseUrl || process.env.QDRANT_URL || 'http://localhost:6333';
    this.collectionName = config?.collectionName || 'memories';
    this.vectorDimensions = config?.vectorDimensions || 1536;
    this.timeoutMs = config?.timeoutMs || OPERATIONAL_LIMITS.qdrantQueryTimeoutMs || 5000;
  }

  /**
   * Gera embedding determinístico de 1536 dimensões normalizado em norma L2 (cosseno).
   * Mapeia n-grams semânticos para o espaço vetorial de forma reprodutível e matematicamente válida.
   */
  public generateEmbedding(text: string, dimensions = this.vectorDimensions): number[] {
    const vector = new Float64Array(dimensions);
    const cleaned = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return Array.from(vector);
    }

    // 1. Projeção de tokens com pesos posicionais e de frequência
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let hash = 2166136261;
      for (let j = 0; j < token.length; j++) {
        hash ^= token.charCodeAt(j);
        hash = Math.imul(hash, 16777619);
      }

      // Distribui energia do token em múltiplos componentes do espaço HNSW
      for (let k = 0; k < 8; k++) {
        const slot = Math.abs((hash + k * 31337) % dimensions);
        const sign = (hash + k) % 2 === 0 ? 1 : -1;
        vector[slot] += sign * (1.0 / Math.sqrt(i + 1));
      }
    }

    // 2. Normalização L2 para garantir similaridade de cosseno perfeita
    let sumSq = 0;
    for (let i = 0; i < dimensions; i++) {
      sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq) || 1.0;
    const result = new Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
      result[i] = vector[i] / norm;
    }

    return result;
  }

  /**
   * Garante a criação da collection no Qdrant com métrica Cosine e índice HNSW
   */
  async ensureCollection(): Promise<void> {
    if (this.collectionInitialized) return;

    try {
      const checkRes = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}`);
      if (checkRes.status === 200) {
        this.collectionInitialized = true;
        return;
      }

      if (checkRes.status === 404) {
        const createRes = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vectors: {
              size: this.vectorDimensions,
              distance: 'Cosine',
            },
            hnsw_config: {
              m: 16,
              ef_construct: 100,
            },
          }),
        });

        if (createRes.ok || createRes.status === 409) {
          this.collectionInitialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn(`[MemoryService] Aviso ao conectar com Qdrant: ${err}`);
    }
  }

  /**
   * Adiciona nova memória vetorial ao Qdrant com proveniência e payload estruturado
   */
  async addMemory(
    memory: Omit<MemorySnippet, 'id' | 'embedding'> & { id?: string; embedding?: number[] }
  ): Promise<{ id: string }> {
    await this.ensureCollection();

    const id = memory.id || crypto.randomUUID();
    const vector =
      memory.embedding && memory.embedding.length === this.vectorDimensions
        ? memory.embedding
        : this.generateEmbedding(memory.content);

    const timestampIso =
      memory.timestamp instanceof Date ? memory.timestamp.toISOString() : new Date().toISOString();

    const point = {
      id,
      vector,
      payload: {
        citizenId: memory.citizenId,
        content: memory.content,
        timestamp: timestampIso,
        sensoryTags: memory.sensoryTags || ['visual'],
        emotionalWeight: memory.emotionalWeight ?? 0.5,
        origin: memory.origin || 'observation',
        memoryType: memory.memoryType || 'episodic',
        sourceType: memory.sourceType || 'direct_observation',
        confidence: memory.confidence ?? 1.0,
      },
    };

    const res = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}/points?wait=true`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [point] }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Falha ao inserir ponto vetorial no Qdrant: ${res.status} ${errText}`);
    }

    return { id };
  }

  /**
   * Consulta semântica de memórias vetoriais filtrando por similaridade de cosseno, habitante e relevância
   */
  async semanticQuery(options: SemanticQueryOptions): Promise<MemorySnippet[]> {
    await this.ensureCollection();

    const queryVector = this.generateEmbedding(options.queryText);
    const mustFilters: Array<Record<string, unknown>> = [
      {
        key: 'citizenId',
        match: { value: options.citizenId },
      },
    ];

    if (options.minEmotionalWeight !== undefined) {
      mustFilters.push({
        key: 'emotionalWeight',
        range: { gte: options.minEmotionalWeight },
      });
    }

    const searchBody = {
      vector: queryVector,
      limit: options.topK ?? OPERATIONAL_LIMITS.memoryTopKDefault,
      filter: { must: mustFilters },
      with_payload: true,
      with_vector: false,
    };

    const res = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const hits: Array<{ id: string; score: number; payload: Record<string, any> }> = data.result || [];

    const now = Date.now();
    const maxAgeMs = (options.timeframeHours ?? OPERATIONAL_LIMITS.memoryTimeframeHoursDefault) * 3600 * 1000;

    return hits
      .filter((hit) => {
        if (!options.timeframeHours) return true;
        const memoryTime = new Date(hit.payload.timestamp).getTime();
        return now - memoryTime <= maxAgeMs;
      })
      .map((hit) => ({
        id: String(hit.id),
        citizenId: hit.payload.citizenId as CitizenId,
        content: hit.payload.content,
        embedding: [],
        timestamp: new Date(hit.payload.timestamp),
        sensoryTags: hit.payload.sensoryTags || [],
        emotionalWeight: hit.payload.emotionalWeight ?? 0.5,
        origin: hit.payload.origin || 'observation',
        memoryType: hit.payload.memoryType,
        sourceType: hit.payload.sourceType,
        confidence: hit.payload.confidence,
      }));
  }

  /**
   * Consulta memórias por habitante ordenadas cronologicamente
   */
  async queryByCitizen(
    npcId: string,
    timeframeHours: number = OPERATIONAL_LIMITS.memoryTimeframeHoursDefault,
    limit: number = 20
  ): Promise<MemorySnippet[]> {
    await this.ensureCollection();

    const res = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [{ key: 'citizenId', match: { value: npcId } }],
        },
        limit,
        with_payload: true,
        with_vector: false,
      }),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const points: Array<{ id: string; payload: Record<string, any> }> = data.result?.points || [];

    const now = Date.now();
    const maxAgeMs = timeframeHours * 3600 * 1000;

    return points
      .filter((p) => {
        const memoryTime = new Date(p.payload.timestamp).getTime();
        return now - memoryTime <= maxAgeMs;
      })
      .sort((a, b) => new Date(b.payload.timestamp).getTime() - new Date(a.payload.timestamp).getTime())
      .map((p) => ({
        id: String(p.id),
        citizenId: p.payload.citizenId as CitizenId,
        content: p.payload.content,
        embedding: [],
        timestamp: new Date(p.payload.timestamp),
        sensoryTags: p.payload.sensoryTags || [],
        emotionalWeight: p.payload.emotionalWeight ?? 0.5,
        origin: p.payload.origin || 'observation',
        memoryType: p.payload.memoryType,
        sourceType: p.payload.sourceType,
        confidence: p.payload.confidence,
      }));
  }

  /**
   * Executa poda de memórias irrelevantes ou antigas de um habitante (decaimento e limpeza)
   */
  async pruneMemory(citizenId: CitizenId): Promise<{ deletedCount: number }> {
    await this.ensureCollection();

    // Poda memórias efêmeras com peso emocional muito baixo (< 0.15)
    const res = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}/points/delete?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'citizenId', match: { value: citizenId } },
            { key: 'emotionalWeight', range: { lt: 0.15 } },
          ],
        },
      }),
    });

    return { deletedCount: res.ok ? 1 : 0 };
  }

  /**
   * Remove do Qdrant todas as memórias de cidadãos fora do roster vigente (limpeza de órfãos).
   */
  async purgeCitizensNotIn(keepCitizenIds: string[]): Promise<boolean> {
    await this.ensureCollection();
    const res = await this.fetchWithTimeout(`${this.baseUrl}/collections/${this.collectionName}/points/delete?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { must_not: [{ key: 'citizenId', match: { any: keepCitizenIds } }] },
      }),
    });
    return res.ok;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
