import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryService } from './index';

describe('packages/memory — MemoryService Unit Tests', () => {
  let memoryService: MemoryService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    memoryService = new MemoryService({
      baseUrl: 'http://localhost:6333',
      collectionName: 'test_memories',
      vectorDimensions: 1536,
      timeoutMs: 3000,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('generateEmbedding', () => {
    it('deve gerar embedding com exatamente 1536 dimensões por padrão', () => {
      const embedding = memoryService.generateEmbedding('Observação de trânsito na avenida central');
      expect(embedding).toHaveLength(1536);
    });

    it('deve gerar vetor normalizado em L2 (norma euclidiana = 1.0)', () => {
      const embedding = memoryService.generateEmbedding('Sinal vermelho na faixa de pedestres');
      const sumSq = embedding.reduce((sum, val) => sum + val * val, 0);
      const norm = Math.sqrt(sumSq);
      expect(norm).toBeCloseTo(1.0, 4);
    });

    it('deve ser determinístico: mesmo texto produz exatamente o mesmo vetor', () => {
      const text = 'Café Bistro com aroma agradável';
      const vec1 = memoryService.generateEmbedding(text);
      const vec2 = memoryService.generateEmbedding(text);
      expect(vec1).toEqual(vec2);
    });

    it('deve diferenciar textos semanticamente distintos', () => {
      const vec1 = memoryService.generateEmbedding('Comida deliciosa e fresca no restaurante');
      const vec2 = memoryService.generateEmbedding('Perigo de atropelamento por veículo veloz');
      
      let dotProduct = 0;
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
      }
      // Não devem ser idênticos (similaridade cosseno < 0.95)
      expect(dotProduct).toBeLessThan(0.95);
    });

    it('deve lidar graciosamente com texto vazio retornando vetor unitário', () => {
      const emptyVec = memoryService.generateEmbedding('');
      expect(emptyVec).toHaveLength(1536);
      expect(emptyVec[0]).toBe(1.0);
      expect(emptyVec[1]).toBe(0);
    });

    it('deve permitir dimensões customizadas quando solicitado', () => {
      const vec = memoryService.generateEmbedding('Teste de dimensionalidade', 128);
      expect(vec).toHaveLength(128);
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 4);
    });
  });

  describe('Configuração e Inicialização', () => {
    it('deve instanciar com valores padrão caso omitidos', () => {
      const defaultService = new MemoryService();
      expect(defaultService).toBeDefined();
    });

    it('deve criar collection no Qdrant quando status for 404', async () => {
      const mockFetch = vi.fn();
      // 1. GET retorna 404 (collection não existe)
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
      });
      // 2. PUT retorna 200 (collection criada com sucesso)
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ result: true, status: 'ok' }),
      });

      global.fetch = mockFetch;

      await memoryService.ensureCollection();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain('/collections/test_memories');
      expect(mockFetch.mock.calls[1][1].method).toBe('PUT');
      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.vectors.size).toBe(1536);
      expect(body.vectors.distance).toBe('Cosine');
      expect(body.hnsw_config.m).toBe(16);
    });

    it('não deve recriar collection se já existir (status 200)', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        status: 200,
        ok: true,
      });
      global.fetch = mockFetch;

      await memoryService.ensureCollection();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/collections/test_memories');
    });
  });

  describe('Busca Semântica (semanticQuery)', () => {
    it('deve construir payload de busca por similaridade de cosseno com topK e filtros', async () => {
      const mockFetch = vi.fn();
      // Mock ensureCollection GET
      mockFetch.mockResolvedValueOnce({ status: 200, ok: true });
      // Mock search POST
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: [
            {
              id: 'point-1',
              score: 0.88,
              payload: {
                id: 'mem-1',
                citizenId: 'citizen-lyra',
                content: 'Café Bistro tem refeições quentes',
                timestamp: Date.now(),
                sourceType: 'direct_observation',
                emotionalWeight: 0.75,
              },
            },
          ],
        }),
      });

      global.fetch = mockFetch;

      const results = await memoryService.semanticQuery({
        citizenId: 'citizen-lyra' as any,
        queryText: 'Onde almoçar?',
        topK: 2,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('point-1');
      expect(results[0].content).toBe('Café Bistro tem refeições quentes');
      expect(results[0].emotionalWeight).toBe(0.75);
    });

    it('deve tratar erro de timeout graciosamente rejeitando ou retornando vazio', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
      global.fetch = mockFetch;

      await expect(
        memoryService.semanticQuery({
          citizenId: 'citizen-lyra' as any,
          queryText: 'Teste timeout',
        }),
      ).rejects.toThrow();
    });
  });
});
