// apps/api/src/modules/marketplace/marketplace.service.ts
import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import {
  MarketplaceRepository,
  StoreRow,
  ProductRow,
  ProductFactRow,
} from '@cidade-virtual/persistence';
import { TOMPETS_STORE, TOMPETS_SEED_PRODUCTS } from './marketplace.seed';

@Injectable()
export class MarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @Inject(MarketplaceRepository)
    private readonly marketplaceRepo: MarketplaceRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedTomPetsStore();
  }

  /**
   * Semeia a loja TomPets e seu catálogo inicial de produtos novos e usados de forma estritamente idempotente.
   */
  async seedTomPetsStore(): Promise<{
    store: StoreRow;
    productsCount: number;
    factsCount: number;
  }> {
    this.logger.log('Semeando loja TomPets e catálogo de produtos no PostgreSQL...');

    // 1. Upsert da loja
    const store = await this.marketplaceRepo.upsertStore(TOMPETS_STORE);

    let productsCount = 0;
    let factsCount = 0;

    // 2. Upsert de cada produto e seus fatos estruturados
    for (const item of TOMPETS_SEED_PRODUCTS) {
      await this.marketplaceRepo.upsertProduct(item.product);
      productsCount++;

      // Fatos para RAG Grounding
      const existingFacts = await this.marketplaceRepo.listProductFacts(item.product.id);
      const existingKeys = new Set(existingFacts.map((f) => f.attributeKey));

      const newFacts = item.facts
        .filter((f) => !existingKeys.has(f.attributeKey))
        .map((f) => ({
          productId: item.product.id,
          storeId: store.id,
          attributeKey: f.attributeKey,
          factStatement: f.factStatement,
          sourceId: f.sourceId,
        }));

      if (newFacts.length > 0) {
        await this.marketplaceRepo.addProductFacts(newFacts);
        factsCount += newFacts.length;
      }
    }

    this.logger.log(
      `Loja TomPets sincronizada com sucesso: ${productsCount} produtos e ${factsCount} novos fatos registrados.`
    );

    return { store, productsCount, factsCount };
  }

  async listStores(): Promise<StoreRow[]> {
    return this.marketplaceRepo.listStores();
  }

  async searchStores(query?: string): Promise<StoreRow[]> {
    const stores = await this.marketplaceRepo.listStores();
    if (!query || query.trim() === '') {
      return stores;
    }
    const q = query.toLowerCase().trim();
    return stores.filter((s) => {
      const name = s.name.toLowerCase();
      const slug = s.slug.toLowerCase();
      const address = (s.addressBox || '').toLowerCase();
      const category = (s.category || '').toLowerCase();
      return (
        name.includes(q) ||
        slug.includes(q) ||
        address.includes(q) ||
        category.includes(q)
      );
    });
  }

  async getStoreBySlug(slug: string): Promise<StoreRow | null> {
    return this.marketplaceRepo.getStoreBySlug(slug);
  }

  async getStoreById(id: string): Promise<StoreRow | null> {
    return this.marketplaceRepo.getStoreById(id);
  }

  async listStoreProducts(
    storeId: string,
    filters?: { condition?: string; category?: string },
  ): Promise<ProductRow[]> {
    return this.marketplaceRepo.listProductsByStore(storeId, filters);
  }

  async getProduct(productId: string): Promise<{
    product: ProductRow;
    facts: ProductFactRow[];
  } | null> {
    const product = await this.marketplaceRepo.getProductById(productId);
    if (!product) return null;

    const facts = await this.marketplaceRepo.listProductFacts(productId);
    return { product, facts };
  }

  /**
   * Tool determinística de preço: garante que o LLM nunca invente valores.
   */
  async getPrice(productId: string): Promise<{ priceCents: number; currency: string } | null> {
    const product = await this.marketplaceRepo.getProductById(productId);
    if (!product) return null;
    return { priceCents: product.priceCents, currency: product.currency };
  }

  /**
   * Tool determinística de estoque: garante informação real em tempo de execução.
   */
  async checkStock(productId: string): Promise<{ available: boolean; quantity: number } | null> {
    const product = await this.marketplaceRepo.getProductById(productId);
    if (!product) return null;
    return {
      available: product.stockQuantity > 0 && product.status === 'active',
      quantity: product.stockQuantity,
    };
  }
}
