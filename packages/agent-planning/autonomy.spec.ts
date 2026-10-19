// packages/agent-planning/autonomy.spec.ts
import { describe, it, expect, vi } from 'vitest';
import {
  AgentMind,
  SYNAPSE_WORLD_ENTITIES,
  decayNeeds,
  applyEffect,
  rankCandidates,
  generateCandidates,
  distance2D,
  type Needs,
  type Personality,
  type Percept,
} from './index.js';
import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';

describe('Autonomia Real dos Agentes — Sem Roteiros Pré-fixados', () => {
  const basePersonality: Personality = {
    openness: 0.8,
    conscientiousness: 0.6,
    extraversion: 0.7,
    agreeableness: 0.8,
    neuroticism: 0.3,
  };

  const fullNeeds: Needs = {
    energy: 1.0,
    hunger: 1.0,
    social: 1.0,
    curiosity: 1.0,
    fun: 1.0,
  };

  it('deve registrar entidades do mundo com affordances e coordenadas físicas válidas', () => {
    expect(SYNAPSE_WORLD_ENTITIES.length).toBeGreaterThanOrEqual(10);

    const fountain = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'fountain-monumental');
    expect(fountain).toBeDefined();
    expect(fountain?.affordances).toContain('contemplate');
    expect(fountain?.position.x).toBe(-22);

    const market = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'market-central');
    expect(market).toBeDefined();
    expect(market?.affordances).toContain('shop');
    expect(market?.affordances).toContain('eat');

    const cafe = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'cafe-bistro');
    expect(cafe?.affordances).toContain('eat');
  });

  it('deve decair necessidades com o tempo e modular pelo perfil de personalidade', () => {
    const introvert: Personality = { ...basePersonality, extraversion: 0.1 };
    const extrovert: Personality = { ...basePersonality, extraversion: 0.9 };

    const decayedIntro = decayNeeds(fullNeeds, introvert, 600); // 10 minutos
    const decayedExtro = decayNeeds(fullNeeds, extrovert, 600);

    // O extrovertido sente mais rápido a carência social
    expect(decayedExtro.social).toBeLessThan(decayedIntro.social);
    expect(decayedIntro.energy).toBeLessThan(1.0);
  });

  it('deve restaurar necessidades correspondentes ao aplicar efeito de uma affordance', () => {
    const starvedNeeds: Needs = {
      energy: 0.2,
      hunger: 0.1,
      social: 0.3,
      curiosity: 0.4,
      fun: 0.2,
    };

    const afterEating = applyEffect(starvedNeeds, { hunger: 0.6, energy: 0.1 });
    expect(afterEating.hunger).toBeCloseTo(0.7);
    expect(afterEating.energy).toBeCloseTo(0.3);
  });

  it('deve priorizar alimentação quando com fome e descanso quando exausto sem ordem pré-fixada', () => {
    const agentPos = { x: -20, y: 0.19, z: 20 }; // perto da praça

    const percept: Percept = {
      position: agentPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(agentPos, e.approach ?? e.position),
      })),
      actors: [],
      trafficLight: 'green',
    };

    // Caso 1: Agente faminto (hunger = 0.05, energia cheia)
    const hungryNeeds: Needs = {
      energy: 0.9,
      hunger: 0.05,
      social: 0.8,
      curiosity: 0.8,
      fun: 0.8,
    };

    const hungryCandidates = generateCandidates(agentPos, percept);
    const hungryRanked = rankCandidates(hungryCandidates, hungryNeeds, basePersonality, {});

    // A melhor opção deve ser de alimentação (eat / shop)
    expect(['eat', 'shop']).toContain(hungryRanked[0].affordance);
    expect(['market-central', 'cafe-bistro', 'cafe-table-outdoor']).toContain(
      hungryRanked[0].targetId,
    );

    // Caso 2: Agente exausto (energy = 0.05, saciado)
    const exhaustedNeeds: Needs = {
      energy: 0.05,
      hunger: 0.9,
      social: 0.8,
      curiosity: 0.8,
      fun: 0.8,
    };

    const tiredCandidates = generateCandidates(agentPos, percept);
    const tiredRanked = rankCandidates(tiredCandidates, exhaustedNeeds, basePersonality, {});

    // A melhor opção deve ser de descanso em um banco próximo
    expect(tiredRanked[0].affordance).toBe('rest');
    expect(tiredRanked[0].targetId).toMatch(/^bench-praca/);
  });

  it('deve penalizar repetição do mesmo alvo para garantir variação natural de comportamento', () => {
    const agentPos = { x: -20, y: 0.19, z: 20 };
    const percept: Percept = {
      position: agentPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(agentPos, e.approach ?? e.position),
      })),
      actors: [],
      trafficLight: 'green',
    };

    const candidates = generateCandidates(agentPos, percept);
    const initialRank = rankCandidates(candidates, fullNeeds, basePersonality, {});
    const topChoice = initialRank[0];

    // Simula que acabou de visitar esse alvo repetidas vezes
    const memory = {
      lastVisitedAt: { [topChoice.id]: Date.now() - 30000 },
      visitCounts: { [topChoice.targetId]: 3 },
    };

    const reranked = rankCandidates(candidates, fullNeeds, basePersonality, memory);

    // O score do alvo repetido deve ter caído expressivamente
    const repeatedOption = reranked.find((c) => c.id === topChoice.id);
    expect(repeatedOption?.score).toBeLessThan(topChoice.score);
  });

  it('deve priorizar interação social quando o avatar Daniel estiver próximo', async () => {
    const mind = new AgentMind({
      id: 'agent-test',
      name: 'Vega',
      role: 'Pioneira',
      biography: 'Gosta de observar e conversar com pessoas',
      personality: basePersonality,
    });

    const agentPos = { x: -10, y: 0.19, z: -10 };
    const perceptWithPlayer: Percept = {
      position: agentPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(agentPos, e.approach ?? e.position),
      })),
      actors: [
        {
          id: 'avatar-daniel',
          name: 'Daniel',
          kind: 'player',
          position: { x: -8, y: 0.19, z: -10 },
          distance: 2.0,
        },
      ],
      trafficLight: 'green',
    };

    const intention = await mind.decideNextIntention(agentPos, perceptWithPlayer);

    expect(intention).toBeDefined();
    expect(intention.candidate.targetId).toBe('avatar-daniel');
    expect(intention.candidate.affordance).toBe('socialize');
  });

  it('deve integrar deliberação estruturada com LLM e aplicar ação sem roteiro pré-fixado', async () => {
    const mockLLM: LLMProviderAdapter = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          chosenCandidateId: 'eat:cafe-bistro',
          thought: 'Sinto vontade de tomar um café fresco e apreciar a rua.',
          speech: 'Vou até o Café Bistro tomar um café expresso!',
        }),
      }),
    };

    const mind = new AgentMind({
      id: 'agent-sheliak',
      name: 'Sheliak',
      role: 'Engenheiro Urbano',
      biography: 'Engenheiro atento ao movimento da cidade',
      personality: basePersonality,
    });

    const agentPos = { x: 20, y: 0.19, z: -15 };
    const percept: Percept = {
      position: agentPos,
      entities: SYNAPSE_WORLD_ENTITIES.map((e) => ({
        entity: e,
        distance: distance2D(agentPos, e.approach ?? e.position),
      })),
      actors: [
        {
          id: 'avatar-daniel',
          name: 'Daniel',
          kind: 'player',
          position: { x: 21, y: 0.19, z: -15 },
          distance: 1.5,
        },
      ],
      trafficLight: 'green',
    };

    const intention = await mind.decideNextIntention(agentPos, percept, mockLLM);

    expect(mockLLM.complete).toHaveBeenCalled();
    expect(intention.candidate.targetId).toBe('cafe-bistro');
    expect(intention.source).toBe('llm');
    expect(intention.speech).toBe('Vou até o Café Bistro tomar um café expresso!');
  });
});
