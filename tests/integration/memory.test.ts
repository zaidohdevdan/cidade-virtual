import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryService } from '../../packages/memory';
import type { CitizenId } from '@cidade-virtual/types';

describe('Task-001 — Integração MemoryService com Qdrant Vector Engine', () => {
  let memoryService: MemoryService;
  const testCitizenId = 'c1111111-1111-4111-8111-111111111111' as CitizenId;

  beforeAll(async () => {
    memoryService = new MemoryService({
      baseUrl: 'http://localhost:6333',
      collectionName: 'memories_test',
    });
    await memoryService.ensureCollection();
  });

  it('deve gerar embeddings com dimensionalidade consistente (1536 dimensões L2-normalizadas)', () => {
    const vector1 = memoryService.generateEmbedding('Sinal vermelho na faixa de pedestres');
    expect(vector1).toHaveLength(1536);

    // Verifica que a norma L2 é 1.0 (unit vector)
    const norm = Math.sqrt(vector1.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);

    // O mesmo texto deve gerar o mesmo vetor determinístico
    const vector2 = memoryService.generateEmbedding('Sinal vermelho na faixa de pedestres');
    expect(vector1).toEqual(vector2);
  });

  it('deve adicionar memórias no Qdrant com proveniência e payload completo', async () => {
    const mem1 = await memoryService.addMemory({
      citizenId: testCitizenId,
      content: 'Observou um carro avançando a faixa enquanto o semáforo estava vermelho',
      timestamp: new Date(),
      sensoryTags: ['visual', 'auditory'],
      emotionalWeight: 0.85,
      origin: 'observation',
      memoryType: 'episodic',
      sourceType: 'direct_observation',
      confidence: 0.95,
    });

    expect(mem1.id).toBeDefined();

    const mem2 = await memoryService.addMemory({
      citizenId: testCitizenId,
      content: 'Comprou um café quente na padaria da praça central',
      timestamp: new Date(),
      sensoryTags: ['visual'],
      emotionalWeight: 0.1, // peso baixo para teste de poda
      origin: 'observation',
      memoryType: 'episodic',
      sourceType: 'direct_observation',
    });

    expect(mem2.id).toBeDefined();
  });

  it('deve realizar busca semântica por similaridade de cosseno retornando a memória mais pertinente', async () => {
    // Consulta semântica sobre infração ou trânsito
    const results = await memoryService.semanticQuery({
      citizenId: testCitizenId,
      queryText: 'infração semáforo trânsito vermelho pedestres',
      topK: 2,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('semáforo estava vermelho');
    expect(results[0].citizenId).toBe(testCitizenId);
  });

  it('deve consultar histórico cronológico por habitante', async () => {
    const history = await memoryService.queryByCitizen(testCitizenId, 24, 10);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('deve podar memórias com peso emocional irrelevante', async () => {
    const pruneResult = await memoryService.pruneMemory(testCitizenId);
    expect(pruneResult.deletedCount).toBeGreaterThanOrEqual(1);
  });
});
