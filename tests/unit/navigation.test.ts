// tests/unit/navigation.test.ts
// Testes de conformidade com os critérios de aceite da Task-015

import { describe, it, expect, beforeAll } from 'vitest';
import { NavigationService } from '@cidade-virtual/world-engine';

describe('Task-015 — NavigationService Recast NavMesh', () => {
  let navService: NavigationService;

  beforeAll(async () => {
    navService = new NavigationService();
    await navService.initialize();
  }, 15000);

  it('Critério 1: NPC não atravessa mais paredes (isNavigable falso dentro de prédios e rotas contornam edifícios)', () => {
    // 1. Verificação de posição interior
    expect(navService.isNavigable({ x: -25, y: 0.1, z: -25 })).toBe(false);

    // 2. Rota gerada contorna o edifício
    const path = navService.findPath({ x: -40, y: 0.1, z: -25 }, { x: -10, y: 0.1, z: -25 });
    expect(path.success).toBe(true);
    expect(path.waypoints.length).toBeGreaterThanOrEqual(3);

    for (const pt of path.waypoints) {
      expect(navService.isNavigable(pt)).toBe(true);
    }
  });

  it('Critério 2: Rota recalculada quando semáforo fecha a faixa', () => {
    const from = { x: -9.0, y: 0.1, z: -10.0 };
    const to = { x: 9.0, y: 0.1, z: -10.0 };

    // Semáforo fechado para pedestres
    const closedResult = navService.findPath(from, to, { trafficLightState: 'green' });
    expect(closedResult.recalculatedDueToSignal).toBe(true);
    expect(closedResult.crosswalkIncluded).toBe(false);

    // Semáforo aberto para pedestres
    const openResult = navService.findPath(from, to, { trafficLightState: 'red' });
    expect(openResult.recalculatedDueToSignal).toBe(false);
    expect(openResult.crosswalkIncluded).toBe(true);
  });
});
