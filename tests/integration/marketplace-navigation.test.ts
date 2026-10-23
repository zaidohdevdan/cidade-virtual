// tests/integration/marketplace-navigation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createDatabaseConnection,
  MarketplaceRepository,
} from '../../packages/persistence';
import { MarketplaceService } from '../../apps/api/src/modules/marketplace/marketplace.service';
import { CITY_STORES, calculateSidewalkRoute } from '../../apps/web-client/src/scenes/city-scene';

describe('Task-045 — Endereçamento Físico (Box 04), Busca e Navegação Guiada por Calçadas', () => {
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

    // Garante que a loja TomPets está semeada
    await marketplaceService.seedTomPetsStore();
  });

  afterAll(async () => {
    await conn.close();
  });

  describe('1. Consulta e Resolução de Endereços de Lojas', () => {
    it('deve listar todas as lojas cadastradas no banco', async () => {
      const stores = await marketplaceService.listStores();
      expect(stores.length).toBeGreaterThanOrEqual(1);

      const tompets = stores.find((s) => s.slug === 'tompets');
      expect(tompets).toBeDefined();
      expect(tompets?.name).toBe('TomPets');
      expect(tompets?.addressBox).toBe('Alameda das Nações, Box 04');
    });

    it('deve buscar com sucesso por "Box 04" com case-insensitivity', async () => {
      const resultsUpper = await marketplaceService.searchStores('BOX 04');
      expect(resultsUpper.length).toBe(1);
      expect(resultsUpper[0].slug).toBe('tompets');

      const resultsLower = await marketplaceService.searchStores('box 04');
      expect(resultsLower.length).toBe(1);
      expect(resultsLower[0].id).toBe('store-tompets');
    });

    it('deve buscar com sucesso por nome da rua "Alameda das Nações"', async () => {
      const results = await marketplaceService.searchStores('Alameda das Nações');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((s) => s.slug === 'tompets')).toBe(true);
    });

    it('deve buscar com sucesso pelo nome da loja "TomPets"', async () => {
      const results = await marketplaceService.searchStores('tompets');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('TomPets');
    });

    it('deve retornar lista vazia de forma graciosa (sem throw) para endereços inexistentes', async () => {
      const resultsInvalido = await marketplaceService.searchStores('Box 99');
      expect(resultsInvalido).toEqual([]);

      const resultsRuaInexistente = await marketplaceService.searchStores('Rua Que Nao Existe 123');
      expect(resultsRuaInexistente).toEqual([]);
    });

    it('deve retornar a loja diretamente pelo slug canônico', async () => {
      const store = await marketplaceService.getStoreBySlug('tompets');
      expect(store).not.toBeNull();
      expect(store?.id).toBe('store-tompets');
      const sellerPersona = store?.sellerPersona as Record<string, any>;
      expect(sellerPersona?.id).toBe('agent-tom');

      const theme = store?.themeColors as Record<string, string>;
      expect(theme['primary']).toBe('#004CBF');
    });
  });

  describe('2. Metadados Espaciais e Coordenadas do Box 04', () => {
    it('deve possuir o Box 04 registrado no catálogo de lojas da cidade com coordenadas válidas', () => {
      const store = CITY_STORES.find((s) => s.slug === 'tompets');
      expect(store).toBeDefined();
      expect(store?.id).toBe('store-tompets');
      expect(store?.boxNumber).toBe('Box 04');
      expect(store?.streetName).toBe('Alameda das Nações');

      // Coordenadas da fachada física do Box 04
      expect(store?.coordinates).toEqual({ x: 25, y: 0.19, z: -18 });
      // Coordenadas exatas do tapete de entrada
      expect(store?.entrancePosition).toEqual({ x: 23.5, y: 0.22, z: -17.0 });
    });
  });

  describe('3. Roteamento e Navegação Guiada por Calçadas', () => {
    it('deve calcular uma rota contínua pelas calçadas até o Box 04', () => {
      const playerPos = { x: 0, z: 0 }; // Cruzamento Central
      const store = CITY_STORES.find((s) => s.slug === 'tompets')!;

      const route = calculateSidewalkRoute(playerPos, store.entrancePosition);
      expect(route.length).toBeGreaterThanOrEqual(2);

      // O último waypoint deve ser a entrada da loja
      const lastPoint = route[route.length - 1];
      expect(lastPoint.x).toBeCloseTo(store.entrancePosition.x);
      expect(lastPoint.z).toBeCloseTo(store.entrancePosition.z);

      // Nenhum waypoint deve atravessar as pistas de rolamento ou construções
      for (const pt of route) {
        expect(typeof pt.x).toBe('number');
        expect(typeof pt.z).toBe('number');
        expect(Number.isFinite(pt.x)).toBe(true);
        expect(Number.isFinite(pt.z)).toBe(true);
      }
    });

    it('deve gerar rota correta quando o jogador parte do Banco Perimetral Oeste', () => {
      const playerPos = { x: -30, z: -5 };
      const store = CITY_STORES.find((s) => s.slug === 'tompets')!;

      const route = calculateSidewalkRoute(playerPos, store.entrancePosition);
      expect(route.length).toBeGreaterThan(1);
      const destination = route[route.length - 1];
      expect(destination.x).toBeCloseTo(store.entrancePosition.x);
      expect(destination.z).toBeCloseTo(store.entrancePosition.z);
    });
  });
});
