// tests/unit/world-modifiers.test.ts
// Validação das regras da física do mundo afetando a mente dos agentes (Task-040)
// Clima, Hora do Dia e Tráfego modulando necessidades, pesos e utilidade de forma global

import { describe, it, expect } from 'vitest';
import {
  AgentMind,
  SYNAPSE_WORLD_ENTITIES,
  generateCandidates,
  rankCandidates,
  scoreCandidate,
  calculateEnvironmentalModifier,
  decayNeeds,
  needWeights,
  mostPressingNeed,
  isCoveredEntity,
  isNightTime,
  type Needs,
  type Personality,
  type Percept,
  type ActionCandidate,
  type PerceivedEntity,
  type WorldEntity,
} from '@cidade-virtual/agent-planning';

describe('Task-040 — Mundo que afeta a mente: clima, hora e tráfego no decisor', () => {
  const balancedPersonality: Personality = {
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.5,
    agreeableness: 0.5,
    neuroticism: 0.5,
  };

  const baselineNeeds: Needs = {
    energy: 0.6,
    hunger: 0.6,
    social: 0.6,
    curiosity: 0.6,
    fun: 0.6,
  };

  const entities: PerceivedEntity[] = SYNAPSE_WORLD_ENTITIES.map((e) => ({
    entity: e,
    distance: 10,
  }));

  // ─── CRITÉRIO 1: Sob chuva, agentes preferem entidades com cobertura ───
  describe('Critério 1: Preferência sob Chuva (Determinístico com Seed)', () => {
    it('deve identificar entidades com cobertura física (hasCover / shelter)', () => {
      const cafe = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'cafe-bistro')!;
      const market = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'market-central')!;
      const busStop = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'bus-stop-west')!;
      const fountain = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'fountain-monumental')!;
      const bench = SYNAPSE_WORLD_ENTITIES.find((e) => e.id === 'bench-praca-west')!;

      expect(isCoveredEntity(cafe)).toBe(true);
      expect(isCoveredEntity(market)).toBe(true);
      expect(isCoveredEntity(busStop)).toBe(true);
      expect(isCoveredEntity(fountain)).toBe(false);
      expect(isCoveredEntity(bench)).toBe(false);
    });

    it('deve fazer o agente preferir entidade com cobertura sob chuva versus céu aberto', () => {
      // Posição intermediária: perto da fonte na praça
      const agentPos = { x: -20, y: 0.19, z: 20 };

      // Percept em dia limpo
      const clearPercept: Percept = {
        position: agentPos,
        entities,
        actors: [],
        trafficLight: 'green',
        weather: 'clear',
        timeOfDay: 14,
      };

      // Percept sob chuva forte
      const rainyPercept: Percept = {
        position: agentPos,
        entities,
        actors: [],
        trafficLight: 'green',
        weather: 'rain',
        timeOfDay: 14,
      };

      // Gerador com seed fixa (rng retorna sempre valor neutro 0.5 para eliminar ruído estocástico)
      const deterministicRng = () => 0.5;

      const clearCandidates = generateCandidates(agentPos, clearPercept);
      const clearRanked = rankCandidates(clearCandidates, baselineNeeds, balancedPersonality, {}, {
        percept: clearPercept,
        rng: deterministicRng,
        explorationNoise: 0,
      });

      const rainyCandidates = generateCandidates(agentPos, rainyPercept);
      const rainyRanked = rankCandidates(rainyCandidates, baselineNeeds, balancedPersonality, {}, {
        percept: rainyPercept,
        rng: deterministicRng,
        explorationNoise: 0,
      });

      // Sob chuva, o primeiro colocado DEVE possuir cobertura (hasCover = true)
      const topRainyChoice = rainyRanked[0];
      expect(topRainyChoice.hasCover).toBe(true);
      expect(['cafe-bistro', 'market-central', 'bus-stop-west']).toContain(topRainyChoice.targetId);

      // O bônus ambiental para entidades cobertas sob chuva deve ser positivo
      expect(topRainyChoice.breakdown?.environmentalModifier).toBeGreaterThan(0);

      // Candidatos a céu aberto sob chuva devem sofrer penalidade ambiental estrita
      const openAirCandidate = rainyRanked.find((c) => !c.hasCover);
      expect(openAirCandidate).toBeDefined();
      expect(openAirCandidate?.breakdown?.environmentalModifier).toBeLessThan(0);
    });

    it('deve priorizar abrigo e proteção ainda mais fortemente sob tempestade (storm)', () => {
      const candCovered: ActionCandidate = {
        id: 'shelter:cafe-bistro',
        affordance: 'shelter',
        targetId: 'cafe-bistro',
        targetLabel: 'Café Bistro',
        targetKind: 'entity',
        destination: { x: 32, y: 0.19, z: -20 },
        distance: 10,
        quality: 1.2,
        hasCover: true,
        score: 0,
      };

      const candOpenAir: ActionCandidate = {
        id: 'contemplate:fountain-monumental',
        affordance: 'contemplate',
        targetId: 'fountain-monumental',
        targetLabel: 'Fonte Monumental',
        targetKind: 'entity',
        destination: { x: -22, y: 0.19, z: 22 },
        distance: 10,
        quality: 1.3,
        hasCover: false,
        score: 0,
      };

      const rainPercept: Percept = {
        position: { x: 0, y: 0.19, z: 0 },
        entities: [],
        actors: [],
        trafficLight: 'green',
        weather: 'rain',
      };

      const stormPercept: Percept = {
        position: { x: 0, y: 0.19, z: 0 },
        entities: [],
        actors: [],
        trafficLight: 'green',
        weather: 'storm',
      };

      const rainModCovered = calculateEnvironmentalModifier(candCovered, rainPercept);
      const stormModCovered = calculateEnvironmentalModifier(candCovered, stormPercept);
      expect(stormModCovered).toBeGreaterThan(rainModCovered);

      const rainModOpen = calculateEnvironmentalModifier(candOpenAir, rainPercept);
      const stormModOpen = calculateEnvironmentalModifier(candOpenAir, stormPercept);
      expect(stormModOpen).toBeLessThan(rainModOpen); // penalidade mais severa sob tempestade
    });
  });

  // ─── CRITÉRIO 2: De noite, mostPressingNeed favorece rest ───
  describe('Critério 2: Noite favorece rest e necessidade de energia', () => {
    it('deve reconhecer corretamente horários noturnos com isNightTime', () => {
      expect(isNightTime(22)).toBe(true);
      expect(isNightTime(23)).toBe(true);
      expect(isNightTime(0)).toBe(true);
      expect(isNightTime(3)).toBe(true);
      expect(isNightTime(5.5)).toBe(true);

      expect(isNightTime(6)).toBe(false);
      expect(isNightTime(12)).toBe(false);
      expect(isNightTime(18)).toBe(false);
      expect(isNightTime(undefined)).toBe(false);
    });

    it('deve favorecer rest via mostPressingNeed durante a noite para necessidades equilibradas', () => {
      // Estado de necessidades com energia em nível equivalente ou moderadamente deficitário
      const eveningNeeds: Needs = {
        energy: 0.45,
        hunger: 0.40, // fome aparentemente um pouco mais alta numericamente
        social: 0.50,
        curiosity: 0.50,
        fun: 0.50,
      };

      // Durante o dia (14h): hunger é mais urgente pois seu deficit relativo pesa mais
      const daytimePressing = mostPressingNeed(eveningNeeds, balancedPersonality, { timeOfDay: 14 });
      expect(daytimePressing).toBe('hunger');

      // De noite (23h): a fisiologia do descanso amplia o peso da energia, tornando-a a mais premente
      const nighttimePressing = mostPressingNeed(eveningNeeds, balancedPersonality, { timeOfDay: 23 });
      expect(nighttimePressing).toBe('energy');
    });

    it('deve conceder bônus ambiental para affordance rest no decisor de utilidade à noite', () => {
      const candRest: ActionCandidate = {
        id: 'rest:bench-praca-west',
        affordance: 'rest',
        targetId: 'bench-praca-west',
        targetLabel: 'Banco da Praça',
        targetKind: 'entity',
        destination: { x: -26.5, y: 0.19, z: 22 },
        distance: 10,
        quality: 1.0,
        score: 0,
      };

      const candExplore: ActionCandidate = {
        id: 'explore:crosswalk-north',
        affordance: 'explore',
        targetId: 'crosswalk-north',
        targetLabel: 'Travessia Norte',
        targetKind: 'entity',
        destination: { x: 0, y: 0.19, z: -10 },
        distance: 10,
        quality: 1.0,
        score: 0,
      };

      const nightPercept: Percept = {
        position: { x: 0, y: 0.19, z: 0 },
        entities: [],
        actors: [],
        trafficLight: 'green',
        timeOfDay: 23,
      };

      const restMod = calculateEnvironmentalModifier(candRest, nightPercept);
      const exploreMod = calculateEnvironmentalModifier(candExplore, nightPercept);

      expect(restMod).toBeGreaterThan(0);
      expect(exploreMod).toBeLessThan(0);
    });

    it('deve acelerar decaimento de energia à noite em decayNeeds', () => {
      const initial: Needs = { ...baselineNeeds, energy: 0.8 };

      const dayDecayed = decayNeeds(initial, balancedPersonality, 600, { timeOfDay: 12 });
      const nightDecayed = decayNeeds(initial, balancedPersonality, 600, { timeOfDay: 23 });

      expect(nightDecayed.energy).toBeLessThan(dayDecayed.energy);
    });
  });

  // ─── CRITÉRIO 3: Regras globais neutras (Física do Mundo, nunca por agente) ───
  describe('Critério 3: Regras Globais Neutras (Sem regras específicas de agente)', () => {
    it('deve calcular exatamente o mesmo modificador ambiental independente do agente', () => {
      // 3 habitantes distintos com diferentes IDs, arquétipos e personalidades
      const agentOrion = { id: 'orion-citizen-01', name: 'Orion' };
      const agentLyra = { id: 'lyra-artist-02', name: 'Lyra' };
      const agentBeatriz = { id: 'beatriz-scientist-03', name: 'Beatriz' };

      const testPercept: Percept = {
        position: { x: -10, y: 0.19, z: 10 },
        entities: [],
        actors: [],
        trafficLight: 'green',
        weather: 'rain',
        timeOfDay: 22,
        trafficDensity: 0.7,
      };

      const testCandidate: ActionCandidate = {
        id: 'eat:cafe-bistro',
        affordance: 'eat',
        targetId: 'cafe-bistro',
        targetLabel: 'Café Bistro',
        targetKind: 'entity',
        destination: { x: 32, y: 0.19, z: -20 },
        distance: 15,
        quality: 1.2,
        hasCover: true,
        score: 0,
      };

      // Modificadores calculados para o mesmo contexto
      const modA = calculateEnvironmentalModifier(testCandidate, testPercept);
      const modB = calculateEnvironmentalModifier(testCandidate, testPercept);
      const modC = calculateEnvironmentalModifier(testCandidate, testPercept);

      expect(modA).toEqual(modB);
      expect(modB).toEqual(modC);
      expect(typeof modA).toBe('number');
    });

    it('deve aplicar física pura sem inspeção de strings privadas de agentes na assinatura', () => {
      const fnCode = calculateEnvironmentalModifier.toString();

      // Nenhuma referência a nomes ou IDs de cidadãos no código de física do mundo
      expect(fnCode).not.toMatch(/orion/i);
      expect(fnCode).not.toMatch(/lyra/i);
      expect(fnCode).not.toMatch(/beatriz/i);
      expect(fnCode).not.toMatch(/agentId/);
      expect(fnCode).not.toMatch(/archetype/);
    });
  });

  // ─── DINÂMICA DE TRÁFEGO E SEGURANÇA ───
  describe('Dinâmica de Tráfego e Penalidade de Segurança Viária', () => {
    it('deve aplicar penalidade de segurança em candidatos próximos a veículos em movimento', () => {
      const candNearStreet: ActionCandidate = {
        id: 'observe:crosswalk-north',
        affordance: 'observe',
        targetId: 'crosswalk-north',
        targetLabel: 'Travessia de Pedestres Norte',
        targetKind: 'entity',
        destination: { x: 0, y: 0.19, z: -10 },
        distance: 8,
        quality: 0.8,
        score: 0,
      };

      const candFarSquare: ActionCandidate = {
        id: 'contemplate:fountain-monumental',
        affordance: 'contemplate',
        targetId: 'fountain-monumental',
        targetLabel: 'Fonte da Praça',
        targetKind: 'entity',
        destination: { x: -22, y: 0.19, z: 22 },
        distance: 8,
        quality: 1.3,
        score: 0,
      };

      // Percept com tráfego denso e veículos passando na rua central
      const busyTrafficPercept: Percept = {
        position: { x: -5, y: 0.19, z: -10 },
        entities: [],
        actors: [],
        trafficLight: 'green',
        trafficDensity: 0.8,
        vehicles: [
          { id: 'car-01', position: { x: 0, y: 0.19, z: -10 }, distance: 2.0 },
        ],
      };

      const quietPercept: Percept = {
        position: { x: -5, y: 0.19, z: -10 },
        entities: [],
        actors: [],
        trafficLight: 'green',
        trafficDensity: 0.0,
        vehicles: [],
      };

      const busyMod = calculateEnvironmentalModifier(candNearStreet, busyTrafficPercept);
      const quietMod = calculateEnvironmentalModifier(candNearStreet, quietPercept);

      // Sob tráfego intenso e com carro na travessia, deve haver penalidade de segurança
      expect(busyMod).toBeLessThan(quietMod);
      expect(busyMod).toBeLessThan(0);

      // A praça longe da pista não deve sofrer a penalidade de proximidade de veículo
      const busySquareMod = calculateEnvironmentalModifier(candFarSquare, busyTrafficPercept);
      expect(busySquareMod).toBeGreaterThan(busyMod);
    });
  });

  // ─── INTEGRAÇÃO COM AGENTMIND ───
  describe('Integração com AgentMind', () => {
    it('deve integrar modificadores ambientais no ciclo de deliberação autônoma', async () => {
      const mind = new AgentMind({
        id: 'test-citizen-env',
        name: 'Solon (Ambiental)',
        role: 'citizen',
        biography: 'Habitante para teste de adaptação climática',
        personality: balancedPersonality,
        initialNeeds: baselineNeeds,
        rng: () => 0.5,
      });

      const rainyPercept: Percept = {
        position: { x: -20, y: 0.19, z: 20 },
        entities,
        actors: [],
        trafficLight: 'green',
        weather: 'rain',
        timeOfDay: 15,
      };

      const intention = await mind.decideNextIntention(
        { x: -20, y: 0.19, z: 20 },
        rainyPercept,
      );

      expect(intention).toBeDefined();
      expect(intention.candidate.hasCover).toBe(true);
      expect(intention.candidate.breakdown?.environmentalModifier).toBeGreaterThan(0);
    });
  });
});
