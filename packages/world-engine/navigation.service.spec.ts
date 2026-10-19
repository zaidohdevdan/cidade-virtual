// packages/world-engine/navigation.service.spec.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { NavigationService } from './navigation.service.js';
import { SYNAPSE_CITY_STATIC_OBSTACLES } from './geometry-builder.js';

describe('NavigationService (Task-015 — Recast Navigation & NavMesh)', () => {
  let navService: NavigationService;

  beforeAll(async () => {
    navService = new NavigationService();
    await navService.initialize();
  }, 15000);

  describe('Navegação e Anti-Transposição de Paredes/Obstáculos', () => {
    it('deve rejeitar como não navegável qualquer ponto dentro de edifícios e obstáculos estáticos', () => {
      // Mercado Municipal fica em x: [-35, -15], z: [-35, -15]
      const insideBuilding = { x: -25, y: 0.1, z: -25 };
      expect(navService.isNavigable(insideBuilding)).toBe(false);

      // Edifício Norte fica em x: [15, 35], z: [-35, -15]
      const insideEdificioNorte = { x: 25, y: 0.1, z: -25 };
      expect(navService.isNavigable(insideEdificioNorte)).toBe(false);

      // Ponto na calçada livre da Avenida Central
      const onSidewalk = { x: -8.0, y: 0.1, z: 0 };
      expect(navService.isNavigable(onSidewalk)).toBe(true);
    });

    it('NPC não atravessa paredes: deve contornar edifício gerando waypoints externos', () => {
      // Ponto de partida a oeste do Mercado Municipal (-40, 0, -25)
      // Ponto de destino a leste do Mercado Municipal (-10, 0, -25)
      // Uma linha reta passaria direto por dentro do Mercado em x = -25
      const from = { x: -40, y: 0.1, z: -25 };
      const to = { x: -10, y: 0.1, z: -25 };

      const result = navService.findPath(from, to);

      expect(result.success).toBe(true);
      expect(result.waypoints.length).toBeGreaterThanOrEqual(3);

      // Nenhum waypoint pode penetrar o interior do edifício
      for (const wp of result.waypoints) {
        const insideMercado =
          wp.x > -35 + 0.1 && wp.x < -15 - 0.1 && wp.z > -35 + 0.1 && wp.z < -15 - 0.1;
        expect(insideMercado).toBe(false);
        expect(navService.isNavigable(wp)).toBe(true);
      }
    });

    it('deve respeitar obstáculos dinâmicos (veículos na via)', () => {
      const carPosition = { x: 0, y: 0.1, z: -5 };
      expect(navService.isNavigable(carPosition)).toBe(true);

      navService.addDynamicObstacle({
        id: 'car-test-01',
        type: 'box',
        position: carPosition,
        size: { x: 2.2, y: 1.5, z: 4.6 },
        name: 'Carro Estacionado',
      });

      expect(navService.isNavigable(carPosition)).toBe(false);

      navService.removeDynamicObstacle('car-test-01');
      expect(navService.isNavigable(carPosition)).toBe(true);
    });
  });

  describe('Segurança Viária e Semáforo Municipal na Faixa de Pedestres', () => {
    it('deve recalcular rota quando o semáforo veicular estiver verde (pedestres aguardam na calçada)', () => {
      // Semáforo verde para veículos = travessia proibida para pedestres
      navService.setTrafficLightState('green');

      // Pedestre na calçada oeste (-9, 0, -10) tentando atravessar para a calçada leste (9, 0, -10)
      const from = { x: -9.0, y: 0.1, z: -10.0 };
      const to = { x: 9.0, y: 0.1, z: -10.0 };

      const result = navService.findPath(from, to, { trafficLightState: 'green' });

      expect(result.recalculatedDueToSignal).toBe(true);
      expect(result.crosswalkIncluded).toBe(false);

      // O último waypoint deve ser uma posição de espera segura na calçada antes da faixa
      const lastWp = result.waypoints[result.waypoints.length - 1];
      expect(lastWp.x).toBeLessThanOrEqual(-7.0); // Não ingressa na via veicular (x > -7)
    });

    it('deve permitir travessia direta na faixa quando o semáforo veicular estiver vermelho', () => {
      // Semáforo vermelho para veículos = sinal de pedestres liberado
      navService.setTrafficLightState('red');

      const from = { x: -9.0, y: 0.1, z: -10.0 };
      const to = { x: 9.0, y: 0.1, z: -10.0 };

      const result = navService.findPath(from, to, { trafficLightState: 'red' });

      expect(result.recalculatedDueToSignal).toBe(false);
      expect(result.crosswalkIncluded).toBe(true);

      const finalWp = result.waypoints[result.waypoints.length - 1];
      expect(finalWp.x).toBeGreaterThan(0); // Atravessou a pista com sucesso
    });
  });
});
