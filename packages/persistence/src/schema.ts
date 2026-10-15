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
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [
    index('idx_agent_exp_agent_id').on(table.agentId),
    index('idx_agent_exp_occurred_at').on(table.occurredAt),
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
