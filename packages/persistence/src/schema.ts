import {
  pgTable,
  varchar,
  bigint,
  integer,
  timestamp,
  text,
  numeric,
  boolean,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 1. Estado Autoritativo do Mundo e Regiões
 */
export const worldStateTable = pgTable('world_state', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  tickCount: bigint('tick_count', { mode: 'number' }).default(0).notNull(),
  timeOfDay: integer('time_of_day').default(12).notNull(),
  weather: varchar('weather', { length: 32 }).default('clear').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WorldStateRow = typeof worldStateTable.$inferSelect;
export type NewWorldStateRow = typeof worldStateTable.$inferInsert;

/**
 * 2. Identidades Persistentes dos Habitantes (Seção 3.2)
 */
export const agentIdentitiesTable = pgTable('agent_identities', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  archetype: varchar('archetype', { length: 64 }).default('citizen').notNull(),
  profileData: jsonb('profile_data').default({}).notNull(),
  activeGoals: jsonb('active_goals').default([]).notNull(),
  preferences: jsonb('preferences').default({}).notNull(),
  currentLocation: jsonb('current_location').default({ x: 0, y: 0, z: 0 }).notNull(),
  emotionState: varchar('emotion_state', { length: 32 }).default('calm').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AgentIdentityRow = typeof agentIdentitiesTable.$inferSelect;
export type NewAgentIdentityRow = typeof agentIdentitiesTable.$inferInsert;

/**
 * 3. Registro Estruturado de Experiências (Seção 5)
 */
export const agentExperiencesTable = pgTable(
  'agent_experiences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: varchar('agent_id', { length: 64 })
      .notNull()
      .references(() => agentIdentitiesTable.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    description: text('description').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    locationId: varchar('location_id', { length: 64 }),
    sourceType: varchar('source_type', { length: 32 }).notNull(),
    sourceAgentId: varchar('source_agent_id', { length: 64 }),
    confidence: numeric('confidence', { precision: 3, scale: 2 }).default('1.00').notNull(),
    importance: numeric('importance', { precision: 3, scale: 2 }).default('0.50').notNull(),
    relatedEntityIds: text('related_entity_ids').array().default([]).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [
    index('idx_agent_exp_agent_id').on(table.agentId),
    index('idx_agent_exp_occurred_at').on(table.occurredAt.desc()),
  ]
);

export type AgentExperienceRow = typeof agentExperiencesTable.$inferSelect;
export type NewAgentExperienceRow = typeof agentExperiencesTable.$inferInsert;

/**
 * 4. Conhecimento Compartilhado e Cultura Coletiva (Seção 3.9)
 */
export const sharedKnowledgeTable = pgTable('shared_knowledge', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  sourceType: varchar('source_type', { length: 32 }).notNull(),
  originAgentId: varchar('origin_agent_id', { length: 64 }),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).default('1.00').notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow().notNull(),
  historicalUpdates: jsonb('historical_updates').default([]).notNull(),
});

export type SharedKnowledgeRow = typeof sharedKnowledgeTable.$inferSelect;
export type NewSharedKnowledgeRow = typeof sharedKnowledgeTable.$inferInsert;

/**
 * 5. Mente Subjetiva e Memória Hedônica dos Habitantes (Task-036)
 */
export const agentMindsTable = pgTable(
  'agent_minds',
  {
    agentId: varchar('agent_id', { length: 64 })
      .primaryKey()
      .references(() => agentIdentitiesTable.id, { onDelete: 'cascade' }),
    needs: jsonb('needs').notNull(),
    memory: jsonb('memory').notNull(),
    currentIntention: jsonb('current_intention'),
    currentActivity: jsonb('current_activity'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_agent_minds_updated_at').on(table.updatedAt.desc()),
  ]
);

export type AgentMindRow = typeof agentMindsTable.$inferSelect;
export type NewAgentMindRow = typeof agentMindsTable.$inferInsert;

/**
 * 6. Lojas e Boxes do Marketplace (Épico M / Task-044)
 */
export const storesTable = pgTable(
  'stores',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    category: varchar('category', { length: 64 }).default('petshop').notNull(),
    addressBox: varchar('address_box', { length: 128 }).notNull(),
    coordinates: jsonb('coordinates').default({ x: 0, y: 0.19, z: 0 }).notNull(),
    themeColors: jsonb('theme_colors').default({}).notNull(),
    sellerPersona: jsonb('seller_persona').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_stores_slug').on(table.slug),
  ]
);

export type StoreRow = typeof storesTable.$inferSelect;
export type NewStoreRow = typeof storesTable.$inferInsert;

/**
 * 7. Produtos Novos e Usados (Épico M / Task-044)
 */
export const productsTable = pgTable(
  'products',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    storeId: varchar('store_id', { length: 64 })
      .notNull()
      .references(() => storesTable.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    condition: varchar('condition', { length: 32 }).default('new').notNull(), // 'new' | 'used'
    conditionDetails: text('condition_details'),
    priceCents: integer('price_cents').notNull(), // Preço em centavos de Real (sem ponto flutuante)
    currency: varchar('currency', { length: 8 }).default('BRL').notNull(),
    stockQuantity: integer('stock_quantity').default(10).notNull(),
    status: varchar('status', { length: 32 }).default('active').notNull(), // 'active' | 'out_of_stock' | 'paused'
    shelfLocation: jsonb('shelf_location').default({}).notNull(),
    media: jsonb('media').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_products_store_id').on(table.storeId),
    index('idx_products_category').on(table.category),
    index('idx_products_condition').on(table.condition),
  ]
);

export type ProductRow = typeof productsTable.$inferSelect;
export type NewProductRow = typeof productsTable.$inferInsert;

/**
 * 8. Fatos e Características Estruturadas para RAG Grounding (Task-044 / Task-047)
 */
export const productFactsTable = pgTable(
  'product_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: varchar('product_id', { length: 64 })
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    storeId: varchar('store_id', { length: 64 })
      .notNull()
      .references(() => storesTable.id, { onDelete: 'cascade' }),
    attributeKey: varchar('attribute_key', { length: 64 }).notNull(),
    factStatement: text('fact_statement').notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_product_facts_product_id').on(table.productId),
    index('idx_product_facts_store_id').on(table.storeId),
  ]
);

export type ProductFactRow = typeof productFactsTable.$inferSelect;
export type NewProductFactRow = typeof productFactsTable.$inferInsert;

/**
 * 9. Pedidos do Marketplace (Task-048)
 */
export const ordersTable = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: varchar('store_id', { length: 64 })
      .notNull()
      .references(() => storesTable.id),
    userId: varchar('user_id', { length: 64 }).notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: varchar('currency', { length: 8 }).default('BRL').notNull(),
    status: varchar('status', { length: 32 }).default('created').notNull(), // 'created' | 'pending' | 'paid' | 'failed' | 'cancelled'
    items: jsonb('items').default([]).notNull(),
    checkoutUrl: text('checkout_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_user_id').on(table.userId),
    index('idx_orders_store_id').on(table.storeId),
    index('idx_orders_status').on(table.status),
  ]
);

export type OrderRow = typeof ordersTable.$inferSelect;
export type NewOrderRow = typeof ordersTable.$inferInsert;

/**
 * 10. Pagamentos Externos (Mercado Pago / Checkout Pro - Task-048)
 */
export const paymentsTable = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => ordersTable.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).default('mercadopago').notNull(),
    externalPaymentId: varchar('external_payment_id', { length: 128 }).unique(),
    status: varchar('status', { length: 32 }).notNull(), // 'pending' | 'approved' | 'rejected' | 'refunded'
    amountCents: integer('amount_cents').notNull(),
    rawWebhookPayload: jsonb('raw_webhook_payload').default({}),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_order_id').on(table.orderId),
    index('idx_payments_external_id').on(table.externalPaymentId),
  ]
);

export type PaymentRow = typeof paymentsTable.$inferSelect;
export type NewPaymentRow = typeof paymentsTable.$inferInsert;

/**
 * 11. Perfis de Usuário e Escolha de Avatar (Task-043)
 */
export const userProfilesTable = pgTable(
  'user_profiles',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // Google Sub ou ID de usuário
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 128 }),
    avatarConfig: jsonb('avatar_config').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }
);

export type UserProfileRow = typeof userProfilesTable.$inferSelect;
export type NewUserProfileRow = typeof userProfilesTable.$inferInsert;


