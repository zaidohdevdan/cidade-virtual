// packages/persistence/src/repositories/marketplace.repository.ts
import { eq, and, sql } from 'drizzle-orm';
import { AppDatabase } from '../client';
import {
  storesTable,
  StoreRow,
  NewStoreRow,
  productsTable,
  ProductRow,
  NewProductRow,
  productFactsTable,
  ProductFactRow,
  NewProductFactRow,
  ordersTable,
  OrderRow,
  NewOrderRow,
  paymentsTable,
  PaymentRow,
  NewPaymentRow,
  userProfilesTable,
  UserProfileRow,
  NewUserProfileRow,
} from '../schema';

export class MarketplaceRepository {
  constructor(private readonly db: AppDatabase) {}

  // ─── STORES ───
  async getStoreById(id: string): Promise<StoreRow | null> {
    const rows = await this.db.select().from(storesTable).where(eq(storesTable.id, id));
    return rows.length > 0 ? rows[0] : null;
  }

  async getStoreBySlug(slug: string): Promise<StoreRow | null> {
    const rows = await this.db.select().from(storesTable).where(eq(storesTable.slug, slug));
    return rows.length > 0 ? rows[0] : null;
  }

  async listStores(): Promise<StoreRow[]> {
    return this.db.select().from(storesTable);
  }

  async upsertStore(data: NewStoreRow): Promise<StoreRow> {
    const rows = await this.db
      .insert(storesTable)
      .values(data)
      .onConflictDoUpdate({
        target: storesTable.id,
        set: {
          name: data.name,
          slug: data.slug,
          category: data.category,
          addressBox: data.addressBox,
          coordinates: data.coordinates,
          themeColors: data.themeColors,
          sellerPersona: data.sellerPersona,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();
    return rows[0];
  }

  // ─── PRODUCTS ───
  async getProductById(id: string): Promise<ProductRow | null> {
    const rows = await this.db.select().from(productsTable).where(eq(productsTable.id, id));
    return rows.length > 0 ? rows[0] : null;
  }

  async listProductsByStore(
    storeId: string,
    filters?: { condition?: string; category?: string; status?: string }
  ): Promise<ProductRow[]> {
    const conditions = [eq(productsTable.storeId, storeId)];

    if (filters?.condition) {
      conditions.push(eq(productsTable.condition, filters.condition));
    }
    if (filters?.category) {
      conditions.push(eq(productsTable.category, filters.category));
    }
    if (filters?.status) {
      conditions.push(eq(productsTable.status, filters.status));
    }

    return this.db
      .select()
      .from(productsTable)
      .where(and(...conditions));
  }

  async upsertProduct(data: NewProductRow): Promise<ProductRow> {
    const rows = await this.db
      .insert(productsTable)
      .values(data)
      .onConflictDoUpdate({
        target: productsTable.id,
        set: {
          name: data.name,
          slug: data.slug,
          category: data.category,
          condition: data.condition,
          conditionDetails: data.conditionDetails,
          priceCents: data.priceCents,
          currency: data.currency,
          stockQuantity: data.stockQuantity,
          status: data.status,
          shelfLocation: data.shelfLocation,
          media: data.media,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();
    return rows[0];
  }

  async updateStock(productId: string, quantityDelta: number): Promise<ProductRow | null> {
    const rows = await this.db
      .update(productsTable)
      .set({
        stockQuantity: sql`${productsTable.stockQuantity} + ${quantityDelta}`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(productsTable.id, productId))
      .returning();
    return rows.length > 0 ? rows[0] : null;
  }

  // ─── PRODUCT FACTS (RAG GROUNDING) ───
  async listProductFacts(productId: string): Promise<ProductFactRow[]> {
    return this.db
      .select()
      .from(productFactsTable)
      .where(eq(productFactsTable.productId, productId));
  }

  async listStoreFacts(storeId: string): Promise<ProductFactRow[]> {
    return this.db
      .select()
      .from(productFactsTable)
      .where(eq(productFactsTable.storeId, storeId));
  }

  async addProductFact(fact: NewProductFactRow): Promise<ProductFactRow> {
    const rows = await this.db.insert(productFactsTable).values(fact).returning();
    return rows[0];
  }

  async addProductFacts(facts: NewProductFactRow[]): Promise<void> {
    if (facts.length === 0) return;
    await this.db.insert(productFactsTable).values(facts);
  }

  // ─── ORDERS ───
  async createOrder(data: NewOrderRow): Promise<OrderRow> {
    const rows = await this.db.insert(ordersTable).values(data).returning();
    return rows[0];
  }

  async getOrderById(id: string): Promise<OrderRow | null> {
    const rows = await this.db.select().from(ordersTable).where(eq(ordersTable.id, id));
    return rows.length > 0 ? rows[0] : null;
  }

  async updateOrderStatus(orderId: string, status: OrderRow['status']): Promise<OrderRow | null> {
    const rows = await this.db
      .update(ordersTable)
      .set({
        status,
        updatedAt: sql`NOW()`,
      })
      .where(eq(ordersTable.id, orderId))
      .returning();
    return rows.length > 0 ? rows[0] : null;
  }

  // ─── PAYMENTS ───
  async recordPayment(data: NewPaymentRow): Promise<PaymentRow> {
    const rows = await this.db.insert(paymentsTable).values(data).returning();
    return rows[0];
  }

  async getPaymentByExternalId(externalPaymentId: string): Promise<PaymentRow | null> {
    const rows = await this.db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.externalPaymentId, externalPaymentId));
    return rows.length > 0 ? rows[0] : null;
  }

  // ─── USER PROFILES ───
  async upsertUserProfile(data: NewUserProfileRow): Promise<UserProfileRow> {
    const rows = await this.db
      .insert(userProfilesTable)
      .values(data)
      .onConflictDoUpdate({
        target: userProfilesTable.id,
        set: {
          email: data.email,
          displayName: data.displayName,
          avatarConfig: data.avatarConfig,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();
    return rows[0];
  }

  async getUserProfile(id: string): Promise<UserProfileRow | null> {
    const rows = await this.db.select().from(userProfilesTable).where(eq(userProfilesTable.id, id));
    return rows.length > 0 ? rows[0] : null;
  }
}
