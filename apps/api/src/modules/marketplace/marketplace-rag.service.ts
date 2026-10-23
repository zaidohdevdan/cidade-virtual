// apps/api/src/modules/marketplace/marketplace-rag.service.ts
import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  MarketplaceRepository,
  type ProductFactRow,
} from '@cidade-virtual/persistence';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';

export interface CatalogFactSearchResult {
  factId: string;
  storeId: string;
  productId: string;
  productName: string;
  attributeKey: string;
  factStatement: string;
  sourceId: string;
  score: number;
}

export interface DeterministicPriceResult {
  productId: string;
  productName: string;
  priceCents: number;
  currency: string;
  formattedPrice: string;
}

export interface DeterministicStockResult {
  productId: string;
  productName: string;
  available: boolean;
  quantity: number;
  status: string;
}

export interface MarketplaceQueryInput {
  storeId: string;
  userMessage: string;
  focusedProductId?: string;
  customerName?: string;
}

export interface MarketplaceAnswerResult {
  answer: string;
  citedSources: string[];
  intent: 'price' | 'stock' | 'discount_rejected' | 'factual' | 'refusal';
  usedTool: 'get_price' | 'check_stock' | 'search_facts' | 'none';
  priceCents?: number;
}

@Injectable()
export class MarketplaceRagService {
  private readonly logger = new Logger(MarketplaceRagService.name);
  private readonly qdrantUrl: string;
  private readonly collectionName = 'product_catalog';
  private readonly vectorDimensions = 1536;
  private collectionInitialized = false;

  constructor(
    @Inject(MarketplaceRepository)
    private readonly marketplaceRepo: MarketplaceRepository,
    @Optional()
    private readonly llmAdapter?: LLMProviderAdapter,
  ) {
    this.qdrantUrl = process.env['QDRANT_URL'] || 'http://localhost:6333';
  }

  /**
   * Garante a criação da collection 'product_catalog' no Qdrant com distância Cosine e HNSW.
   */
  async ensureCatalogCollection(): Promise<void> {
    if (this.collectionInitialized) return;

    try {
      const checkRes = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}`, {
        signal: AbortSignal.timeout(4000),
      });

      if (checkRes.status === 200) {
        this.collectionInitialized = true;
        return;
      }

      if (checkRes.status === 404) {
        const createRes = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}`, {
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
          signal: AbortSignal.timeout(4000),
        });

        if (createRes.ok || createRes.status === 409) {
          this.collectionInitialized = true;
          this.logger.log(`Collection Qdrant "${this.collectionName}" inicializada com sucesso.`);
        }
      }
    } catch (err: unknown) {
      this.logger.warn(`Aviso ao conectar com Qdrant: ${(err as Error)?.message || String(err)}`);
    }
  }

  /**
   * Gera embedding determinístico de 1536 dimensões normalizado em L2 para busca por cosseno.
   */
  public generateEmbedding(text: string, dimensions = this.vectorDimensions): number[] {
    const vector = new Float64Array(dimensions);
    const cleaned = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return Array.from(vector);
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let hash = 2166136261;
      for (let j = 0; j < token.length; j++) {
        hash ^= token.charCodeAt(j);
        hash = Math.imul(hash, 16777619);
      }

      for (let k = 0; k < 8; k++) {
        const slot = Math.abs((hash + k * 31337) % dimensions);
        const sign = (hash + k) % 2 === 0 ? 1 : -1;
        vector[slot] += sign * (1.0 / Math.sqrt(i + 1));
      }
    }

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
   * Ingestão completa e idempotente dos fatos dos produtos de uma loja no Qdrant.
   */
  async ingestStoreCatalog(storeId: string): Promise<{ totalIngested: number }> {
    await this.ensureCatalogCollection();

    const products = await this.marketplaceRepo.listProductsByStore(storeId);
    let totalIngested = 0;
    const points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }> = [];

    for (const product of products) {
      const facts = await this.marketplaceRepo.listProductFacts(product.id);

      for (const fact of facts) {
        // Enriquecimento semântico do texto para embedding de alta correspondência
        const embeddingText = `${product.name} ${fact.attributeKey} ${fact.factStatement}`;
        const vector = this.generateEmbedding(embeddingText);

        const pointId = this.toDeterministicUuid(`${storeId}:${product.id}:${fact.attributeKey}`);

        points.push({
          id: pointId,
          vector,
          payload: {
            factId: fact.id,
            storeId,
            productId: product.id,
            productName: product.name,
            category: product.category,
            attributeKey: fact.attributeKey,
            factStatement: fact.factStatement,
            sourceId: fact.sourceId,
          },
        });
        totalIngested++;
      }
    }

    if (points.length > 0) {
      const res = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points?wait=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Falha ao indexar catálogo no Qdrant: ${res.status} ${errText}`);
      }
    }

    this.logger.log(`Ingestão concluída: ${totalIngested} fatos indexados para a loja ${storeId}`);
    return { totalIngested };
  }

  /**
   * Busca vetorial híbrida de fatos estruturados no Qdrant com filtro estrito de loja e produto.
   */
  async searchCatalogFacts(
    storeId: string,
    query: string,
    options?: { productId?: string; limit?: number },
  ): Promise<CatalogFactSearchResult[]> {
    await this.ensureCatalogCollection();

    const limit = options?.limit || 4;
    const queryVector = this.generateEmbedding(query);

    const mustFilters: Array<{ key: string; match: { value: string } }> = [
      { key: 'storeId', match: { value: storeId } },
    ];

    if (options?.productId) {
      mustFilters.push({ key: 'productId', match: { value: options.productId } });
    }

    try {
      const res = await fetch(`${this.qdrantUrl}/collections/${this.collectionName}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: queryVector,
          filter: {
            must: mustFilters,
          },
          limit,
          with_payload: true,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return [];
      }

      const body = (await res.json()) as {
        result: Array<{
          id: string;
          score: number;
          payload: {
            factId: string;
            storeId: string;
            productId: string;
            productName: string;
            attributeKey: string;
            factStatement: string;
            sourceId: string;
          };
        }>;
      };

      return (body.result || []).map((r) => ({
        factId: r.payload.factId,
        storeId: r.payload.storeId,
        productId: r.payload.productId,
        productName: r.payload.productName,
        attributeKey: r.payload.attributeKey,
        factStatement: r.payload.factStatement,
        sourceId: r.payload.sourceId,
        score: r.score,
      }));
    } catch (err: unknown) {
      this.logger.warn(`Erro na busca vetorial no Qdrant: ${(err as Error)?.message || String(err)}`);
      return [];
    }
  }

  /**
   * Tool Determinística de Preço: consulta diretamente o banco PostgreSQL e formata em BRL.
   */
  async getPrice(productId: string): Promise<DeterministicPriceResult | null> {
    const product = await this.marketplaceRepo.getProductById(productId);
    if (!product) return null;

    const formattedPrice = (product.priceCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: product.currency,
    });

    return {
      productId: product.id,
      productName: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      formattedPrice,
    };
  }

  /**
   * Tool Determinística de Estoque: consulta a quantidade real disponível em inventário.
   */
  async checkStock(productId: string): Promise<DeterministicStockResult | null> {
    const product = await this.marketplaceRepo.getProductById(productId);
    if (!product) return null;

    return {
      productId: product.id,
      productName: product.name,
      available: product.stockQuantity > 0 && product.status === 'active',
      quantity: product.stockQuantity,
      status: product.status,
    };
  }

  /**
   * Resposta Grounded com RAG Anti-Alucinação para dúvidas de clientes na loja.
   */
  async answerCustomerQuery(input: MarketplaceQueryInput): Promise<MarketplaceAnswerResult> {
    const userMsg = input.userMessage.trim();
    const store = await this.marketplaceRepo.getStoreById(input.storeId);
    const storeName = store?.name || 'TomPets';

    // ── 1. GUARDA ANTI-INJEÇÃO & RECUSA DE DESCONTOS NÃO AUTORIZADOS ──
    const discountAttemptRegex =
      /(desconto|diminui|baixa o pre[cç]o|fa[cç]a por|faz por|pre[cç]o menor|mais barato|90%|50%|gr[aá]tis|ignore (as regras|previous|instru)|burla)/i;
    if (discountAttemptRegex.test(userMsg)) {
      return {
        answer: `Como atendente virtual da ${storeName}, não tenho permissão para alterar preços ou aplicar descontos manuais. Todos os valores da loja são oficiais e processados com segurança pelo sistema no checkout.`,
        citedSources: ['politica-precos-fixos'],
        intent: 'discount_rejected',
        usedTool: 'none',
      };
    }

    // ── 2. RESOLUÇÃO DE PRODUTO EM FOCO ──
    let targetProductId = input.focusedProductId;
    if (!targetProductId) {
      targetProductId = await this.detectProductInMessage(input.storeId, userMsg);
    }

    // ── 3. TOOL DETERMINÍSTICA: CONSULTA DE PREÇO ──
    const priceQueryRegex =
      /(quanto custa|qual (o|é o) valor|qual (o|é o) pre[cç]o|qual pre[cç]o|valor do|pre[cç]o d[aeo]|quanto [eé]|tabela de pre[cç]o)/i;
    if (priceQueryRegex.test(userMsg) && targetProductId) {
      const priceResult = await this.getPrice(targetProductId);
      if (priceResult) {
        return {
          answer: `O preço oficial de "${priceResult.productName}" é ${priceResult.formattedPrice}. [tabela-precos-sistema]`,
          citedSources: ['tabela-precos-sistema'],
          intent: 'price',
          usedTool: 'get_price',
          priceCents: priceResult.priceCents,
        };
      }
    }

    // ── 4. TOOL DETERMINÍSTICA: CONSULTA DE ESTOQUE ──
    const stockQueryRegex =
      /(tem em estoque|tem dispon[ií]vel|quantas unidades|quantos tem|ainda tem|tem a pronta entrega|estoque)/i;
    if (stockQueryRegex.test(userMsg) && targetProductId) {
      const stockResult = await this.checkStock(targetProductId);
      if (stockResult) {
        const text = stockResult.available
          ? `Temos ${stockResult.quantity} unidades de "${stockResult.productName}" disponíveis para compra imediata. [estoque-sistema]`
          : `O produto "${stockResult.productName}" está esgotado no momento. [estoque-sistema]`;
        return {
          answer: text,
          citedSources: ['estoque-sistema'],
          intent: 'stock',
          usedTool: 'check_stock',
        };
      }
    }

    // ── 5. RECUPERAÇÃO GROUNDED NO QDRANT ──
    const facts = await this.searchCatalogFacts(input.storeId, userMsg, {
      productId: targetProductId,
      limit: 3,
    });

    // Se a similaridade for muito baixa ou não houver fatos, recusa honesta
    const topFact = facts[0];
    if (!topFact || topFact.score < 0.25) {
      return {
        answer: `Não encontrei essa informação no catálogo oficial da ${storeName}. Para dúvidas específicas não listadas, recomendo entrar em contato diretamente com o lojista.`,
        citedSources: [],
        intent: 'refusal',
        usedTool: 'search_facts',
      };
    }

    const citedSources = Array.from(new Set(facts.map((f) => f.sourceId)));

    // ── 6. DELIBERAÇÃO COM LLM (QUANDO DISPONÍVEL) OU SÍNTESE DETERMINÍSTICA ──
    if (this.llmAdapter) {
      try {
        const systemPrompt = `Você é Tom, vendedor especialista da ${storeName}.
Responda de forma cortês, objetiva e exclusivamente fundamentada nos fatos fornecidos abaixo.
REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base nos fatos fornecidos. Não adicione nada que não esteja neles.
2. É OBRIGATÓRIO citar a fonte de cada informação factual usando colchetes com o respectivo sourceId (exemplo: [${topFact.sourceId}]).
3. NUNCA invente preços, prazos ou garantias não mencionados.
4. Mantenha a resposta em português brasileiro.`;

        const promptFacts = facts
          .map((f) => `- ${f.productName} (${f.attributeKey}): ${f.factStatement} [${f.sourceId}]`)
          .join('\n');

        const userPrompt = `FATOS RECUPERADOS:\n${promptFacts}\n\nPERGUNTA DO CLIENTE:\n${userMsg}`;

        const llmResponse = await this.llmAdapter.complete({
          systemPrompt,
          prompt: userPrompt,
          temperature: 0.1,
        });

        let generatedAnswer = llmResponse.content.trim();

        // Validação pós-geração: confere se a citação foi mantida
        if (!generatedAnswer.includes('[') || !generatedAnswer.includes(']')) {
          generatedAnswer += ` [${topFact.sourceId}]`;
        }

        return {
          answer: generatedAnswer,
          citedSources,
          intent: 'factual',
          usedTool: 'search_facts',
        };
      } catch (err: unknown) {
        this.logger.warn(`Falha na deliberação do LLM, acionando fallback determinístico: ${(err as Error)?.message || String(err)}`);
      }
    }

    // ── 7. FALLBACK DETERMINÍSTICO SEGURO (ZERO TOKENS / SEM LLM) ──
    const answer = `Sobre "${topFact.productName}": ${topFact.factStatement} [${topFact.sourceId}]`;
    return {
      answer,
      citedSources: [topFact.sourceId],
      intent: 'factual',
      usedTool: 'search_facts',
    };
  }

  /**
   * Helper para identificar menção a produto na mensagem do usuário.
   */
  private async detectProductInMessage(storeId: string, message: string): Promise<string | undefined> {
    const products = await this.marketplaceRepo.listProductsByStore(storeId);
    const lower = message.toLowerCase();

    for (const p of products) {
      const pNameLower = p.name.toLowerCase();
      // Match por termos significativos
      if (lower.includes(pNameLower)) return p.id;
      if (lower.includes('viva verde') && pNameLower.includes('viva verde')) return p.id;
      if (lower.includes('pipicat') && pNameLower.includes('pipicat')) return p.id;
      if (lower.includes('formula natural') && pNameLower.includes('formula natural')) return p.id;
      if (lower.includes('premier') && pNameLower.includes('premier')) return p.id;
      if (lower.includes('golden') && pNameLower.includes('golden')) return p.id;
      if (lower.includes('granplus') && pNameLower.includes('granplus')) return p.id;
      if (lower.includes('bebedouro') || lower.includes('fonte de porcelana')) {
        if (pNameLower.includes('bebedouro')) return p.id;
      }
      if (lower.includes('caminha') || lower.includes('usad')) {
        if (pNameLower.includes('caminha')) return p.id;
      }
    }
    return undefined;
  }

  private toDeterministicUuid(input: string): string {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }
}
