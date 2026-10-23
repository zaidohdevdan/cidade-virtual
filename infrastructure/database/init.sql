-- SYNAPSE CITY ENGINE — Inicialização do Banco Relacional PostgreSQL
-- Versão 2.0.0

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Estado Autoritativo do Mundo e Regiões
CREATE TABLE IF NOT EXISTS world_state (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    tick_count BIGINT DEFAULT 0,
    time_of_day INT DEFAULT 12,
    weather VARCHAR(32) DEFAULT 'clear',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Identidades Persistentes dos Habitantes (Seção 3.2)
CREATE TABLE IF NOT EXISTS agent_identities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    archetype VARCHAR(64) DEFAULT 'citizen',
    profile_data JSONB DEFAULT '{}'::jsonb,
    active_goals JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    current_location JSONB DEFAULT '{"x": 0, "y": 0, "z": 0}'::jsonb,
    emotion_state VARCHAR(32) DEFAULT 'calm',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Registro Estruturado de Experiências (Seção 5)
CREATE TABLE IF NOT EXISTS agent_experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(64) REFERENCES agent_identities(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location_id VARCHAR(64),
    source_type VARCHAR(32) NOT NULL, -- direct_observation, action_result, agent_report, environment, inference
    source_agent_id VARCHAR(64),
    confidence NUMERIC(3, 2) DEFAULT 1.0,
    importance NUMERIC(3, 2) DEFAULT 0.5,
    related_entity_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Conhecimento Compartilhado e Cultura Coletiva (Seção 3.9)
CREATE TABLE IF NOT EXISTS shared_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    origin_agent_id VARCHAR(64),
    confidence NUMERIC(3, 2) DEFAULT 1.0,
    is_verified BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    historical_updates JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_exp_agent_id ON agent_experiences(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_exp_occurred_at ON agent_experiences(occurred_at DESC);

-- 5. Mente Subjetiva e Memória Hedônica dos Habitantes (Task-036)
CREATE TABLE IF NOT EXISTS agent_minds (
    agent_id VARCHAR(64) PRIMARY KEY REFERENCES agent_identities(id) ON DELETE CASCADE,
    needs JSONB NOT NULL DEFAULT '{"energy": 1, "hunger": 0, "social": 0.5, "curiosity": 0.5, "fun": 0.5}'::jsonb,
    memory JSONB NOT NULL DEFAULT '{"lastVisitedAt": {}, "visitCounts": {}, "actorAffinity": {}, "placePreferences": {}, "suggestedTargets": {}}'::jsonb,
    current_intention JSONB,
    current_activity JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_minds_updated_at ON agent_minds(updated_at DESC);

-- 6. Lojas e Boxes do Marketplace (Épico M / Task-044)
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    category VARCHAR(64) DEFAULT 'petshop' NOT NULL,
    address_box VARCHAR(128) NOT NULL,
    coordinates JSONB DEFAULT '{"x": 0, "y": 0.19, "z": 0}'::jsonb NOT NULL,
    theme_colors JSONB DEFAULT '{}'::jsonb NOT NULL,
    seller_persona JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- 7. Produtos Novos e Usados (Épico M / Task-044)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    condition VARCHAR(32) DEFAULT 'new' NOT NULL,
    condition_details TEXT,
    price_cents INT NOT NULL,
    currency VARCHAR(8) DEFAULT 'BRL' NOT NULL,
    stock_quantity INT DEFAULT 10 NOT NULL,
    status VARCHAR(32) DEFAULT 'active' NOT NULL,
    shelf_location JSONB DEFAULT '{}'::jsonb NOT NULL,
    media JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_condition ON products(condition);

-- 8. Fatos e Características Estruturadas para RAG Grounding (Task-044 / Task-047)
CREATE TABLE IF NOT EXISTS product_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    attribute_key VARCHAR(64) NOT NULL,
    fact_statement TEXT NOT NULL,
    source_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_facts_product_id ON product_facts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_facts_store_id ON product_facts(store_id);

-- 9. Pedidos do Marketplace (Task-048)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id VARCHAR(64) NOT NULL REFERENCES stores(id),
    user_id VARCHAR(64) NOT NULL,
    total_cents INT NOT NULL,
    currency VARCHAR(8) DEFAULT 'BRL' NOT NULL,
    status VARCHAR(32) DEFAULT 'created' NOT NULL,
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    checkout_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 10. Pagamentos Externos (Mercado Pago / Checkout Pro - Task-048)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(32) DEFAULT 'mercadopago' NOT NULL,
    external_payment_id VARCHAR(128) UNIQUE,
    status VARCHAR(32) NOT NULL,
    amount_cents INT NOT NULL,
    raw_webhook_payload JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_payment_id);

-- 11. Perfis de Usuário e Escolha de Avatar (Task-043)
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255),
    display_name VARCHAR(128),
    avatar_config JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

