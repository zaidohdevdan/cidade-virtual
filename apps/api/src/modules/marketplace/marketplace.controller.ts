// apps/api/src/modules/marketplace/marketplace.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceRagService } from './marketplace-rag.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    @Inject(MarketplaceService)
    private readonly marketplaceService: MarketplaceService,
    @Inject(MarketplaceRagService)
    private readonly ragService: MarketplaceRagService,
  ) {}

  @Get('stores')
  async listStores(@Query('q') query?: string) {
    return this.marketplaceService.searchStores(query);
  }

  @Get('stores/:slug')
  async getStore(@Param('slug') slug: string) {
    const store = await this.marketplaceService.getStoreBySlug(slug);
    if (!store) {
      throw new NotFoundException(`Loja com slug "${slug}" não encontrada.`);
    }
    return store;
  }

  @Get('stores/:storeId/products')
  async listStoreProducts(
    @Param('storeId') storeId: string,
    @Query('condition') condition?: string,
    @Query('category') category?: string,
  ) {
    return this.marketplaceService.listStoreProducts(storeId, { condition, category });
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    const data = await this.marketplaceService.getProduct(id);
    if (!data) {
      throw new NotFoundException(`Produto "${id}" não encontrado.`);
    }
    return data;
  }

  @Get('products/:id/price')
  async getProductPrice(@Param('id') id: string) {
    const price = await this.ragService.getPrice(id);
    if (!price) {
      throw new NotFoundException(`Produto "${id}" não encontrado.`);
    }
    return price;
  }

  @Get('products/:id/stock')
  async getProductStock(@Param('id') id: string) {
    const stock = await this.ragService.checkStock(id);
    if (!stock) {
      throw new NotFoundException(`Produto "${id}" não encontrado.`);
    }
    return stock;
  }

  /**
   * Endpoint de ingestão do catálogo da loja no Qdrant para RAG Grounding (Task-047).
   */
  @Post('rag/ingest/:storeId')
  async ingestStoreCatalog(@Param('storeId') storeId: string) {
    return this.ragService.ingestStoreCatalog(storeId);
  }

  /**
   * Endpoint de busca vetorial de fatos no Qdrant com citação de source_id.
   */
  @Get('rag/search')
  async searchFacts(
    @Query('storeId') storeId: string,
    @Query('q') query: string,
    @Query('productId') productId?: string,
  ) {
    if (!storeId || !query) {
      throw new BadRequestException('storeId e q são parâmetros obrigatórios.');
    }
    return this.ragService.searchCatalogFacts(storeId, query, { productId });
  }

  /**
   * Endpoint de chat com o vendedor virtual fundamentado em RAG Grounding (Task-047).
   */
  @Post('chat')
  async chatWithAgent(
    @Body()
    body: {
      storeId?: string;
      userMessage?: string;
      focusedProductId?: string;
      customerName?: string;
    },
  ) {
    if (!body?.storeId || !body?.userMessage) {
      throw new BadRequestException('storeId e userMessage são obrigatórios');
    }
    return this.ragService.answerCustomerQuery({
      storeId: body.storeId,
      userMessage: body.userMessage,
      focusedProductId: body.focusedProductId,
      customerName: body.customerName,
    });
  }
}
