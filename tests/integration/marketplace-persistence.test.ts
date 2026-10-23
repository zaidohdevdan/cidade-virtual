// tests/integration/marketplace-persistence.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  MarketplaceRepository,
} from '../../packages/persistence';
import { MarketplaceService } from '../../apps/api/src/modules/marketplace/marketplace.service';
import {
  TOMPETS_STORE,
  TOMPETS_SEED_PRODUCTS,
} from '../../apps/api/src/modules/marketplace/marketplace.seed';

describe('Task-044 — Modelo de Dados e Catálogo da Loja TomPets', () => {
  let conn: ReturnType<typeof createDatabaseConnection>;
  let marketplaceRepo: MarketplaceRepository;
  let marketplaceService: MarketplaceService;

  beforeAll(async () => {
    conn = createDatabaseConnection({
      host: 'localhost',
      port: 5433,
      user: 'synapse',
      password: 'synapse_secret_password',
      database: 'synapse_city',
    });
    marketplaceRepo = new MarketplaceRepository(conn.db);
    marketplaceService = new MarketplaceService(marketplaceRepo);
  });

  afterAll(async () => {
    await conn.close();
  });

  it('deve semear a loja TomPets de forma estritamente idempotente com as cores da Petz', async () => {
    const result1 = await marketplaceService.seedTomPetsStore();
    expect(result1.store.id).toBe('store-tompets');
    expect(result1.store.name).toBe('TomPets');
    expect(result1.store.slug).toBe('tompets');
    expect(result1.store.addressBox).toBe('Alameda das Nações, Box 04');

    // Valida paleta de cores da Petz
    const theme = result1.store.themeColors as Record<string, string>;
    expect(theme['primary']).toBe('#004CBF'); // Azul Royal Petz
    expect(theme['secondary']).toBe('#0F2C59'); // Azul Marinho Profundo
    expect(theme['accent']).toBe('#FFD000'); // Amarelo Solar Petz
    expect(theme['action']).toBe('#FF7A00'); // Laranja de ação

    // Segunda execução para garantir idempotência total
    const result2 = await marketplaceService.seedTomPetsStore();
    expect(result2.productsCount).toBe(TOMPETS_SEED_PRODUCTS.length);
    expect(result2.factsCount).toBe(0); // 0 fatos duplicados
  });

  it('deve listar todos os 8 produtos cadastrados (7 novos + 1 usado) com preços em centavos inteiros', async () => {
    const allProducts = await marketplaceService.listStoreProducts('store-tompets');
    expect(allProducts.length).toBe(8);

    for (const prod of allProducts) {
      // Regra de Ouro: preço NUNCA é float
      expect(Number.isInteger(prod.priceCents)).toBe(true);
      expect(prod.priceCents).toBeGreaterThan(0);
      expect(prod.currency).toBe('BRL');
      expect(['new', 'used']).toContain(prod.condition);
    }

    // Filtrar apenas novos
    const newProducts = await marketplaceService.listStoreProducts('store-tompets', { condition: 'new' });
    expect(newProducts.length).toBe(7);

    // Filtrar apenas usados / oportunidades
    const usedProducts = await marketplaceService.listStoreProducts('store-tompets', { condition: 'used' });
    expect(usedProducts.length).toBe(1);
    expect(usedProducts[0].name).toContain('SEMI-NOVO');
    expect(usedProducts[0].priceCents).toBe(9900); // R$ 99,00
    expect(usedProducts[0].conditionDetails).toBeDefined();
  });

  it('deve conter fatos estruturados com sourceId para cada produto (fundação para RAG Grounding)', async () => {
    const vivaVerde = await marketplaceService.getProduct('prod-viva-verde-4kg');
    expect(vivaVerde).not.toBeNull();
    expect(vivaVerde?.product.name).toContain('Viva Verde');
    expect(vivaVerde?.facts.length).toBeGreaterThanOrEqual(4);

    for (const fact of vivaVerde!.facts) {
      expect(fact.productId).toBe('prod-viva-verde-4kg');
      expect(fact.attributeKey).toBeDefined();
      expect(fact.factStatement.length).toBeGreaterThan(10);
      expect(fact.sourceId).toBeDefined(); // Citação obrigatória
    }

    const fontePorcelana = await marketplaceService.getProduct('prod-fonte-porcelana-csg');
    expect(fontePorcelana?.facts.some((f) => f.attributeKey === 'material')).toBe(true);
  });

  it('tools determinísticas getPrice e checkStock devem retornar dados exatos do banco', async () => {
    // Tool de Preço
    const priceFormulaNatural = await marketplaceService.getPrice('prod-formula-natural-15kg');
    expect(priceFormulaNatural).toEqual({
      priceCents: 34990, // R$ 349,90
      currency: 'BRL',
    });

    // Tool de Estoque
    const stockPipicat = await marketplaceService.checkStock('prod-pipicat-classic-4kg');
    expect(stockPipicat).toEqual({
      available: true,
      quantity: 50,
    });
  });

  it('deve registrar pedidos e pagamentos com precisão inteira em centavos', async () => {
    const order = await marketplaceRepo.createOrder({
      storeId: 'store-tompets',
      userId: 'test-user-google-123',
      totalCents: 6890,
      currency: 'BRL',
      status: 'created',
      items: [
        {
          productId: 'prod-viva-verde-4kg',
          name: 'Areia Viva Verde 4kg',
          quantity: 1,
          unitPriceCents: 6890,
        },
      ],
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=fake-pref-123',
    });

    expect(order.id).toBeDefined();
    expect(order.totalCents).toBe(6890);
    expect(order.status).toBe('created');

    // Registrar pagamento aprovado com ID externo único
    const paymentExtId = `mp-pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payment = await marketplaceRepo.recordPayment({
      orderId: order.id,
      provider: 'mercadopago',
      externalPaymentId: paymentExtId,
      status: 'approved',
      amountCents: 6890,
      rawWebhookPayload: { type: 'payment', action: 'payment.created' },
    });

    expect(payment.id).toBeDefined();
    expect(payment.externalPaymentId).toBe(paymentExtId);
    expect(payment.amountCents).toBe(6890);

    // Atualiza status do pedido para paid
    const updatedOrder = await marketplaceRepo.updateOrderStatus(order.id, 'paid');
    expect(updatedOrder?.status).toBe('paid');
  });
});
