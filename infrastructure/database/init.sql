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
