/// <reference path="./recast.d.ts" />
// packages/world-engine/navigation.service.ts
// SYNAPSE CITY ENGINE — Serviço autoritativo de navegação espacial com Recast Navigation
// Alinhado ao SKILL.md Seção 3.1, Seção 4 e Task-015

import { init, NavMesh, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh, soloNavMeshGeneratorConfigDefaults } from '@recast-navigation/generators';
import type {
  Vector3Like,
  NavMeshGeometryInput,
  SceneObstacle,
  DynamicObstacle,
  PathfindingOptions,
  PathfindingResult,
} from './types.js';
import {
  buildMeshFromObstacles,
  SYNAPSE_CITY_STATIC_OBSTACLES,
  DEFAULT_CITY_BOUNDS,
} from './geometry-builder.js';

export class NavigationService {
  private navMesh: NavMesh | null = null;
  private navMeshQuery: NavMeshQuery | null = null;
  private staticObstacles: SceneObstacle[] = [];
  private dynamicObstacles = new Map<string, DynamicObstacle>();
  private currentTrafficLightState: 'red' | 'yellow' | 'green' = 'red';
  private initialized = false;

  /**
   * Inicializa o motor Recast WASM e constrói a NavMesh a partir da geometria e obstáculos da cidade.
   */
  async initialize(
    worldGeometry?: NavMeshGeometryInput,
    colliders: SceneObstacle[] = SYNAPSE_CITY_STATIC_OBSTACLES,
  ): Promise<void> {
    await init();

    this.staticObstacles = [...colliders];

    let meshData: NavMeshGeometryInput;
    if (worldGeometry && worldGeometry.positions.length > 0) {
      meshData = worldGeometry;
    } else {
      meshData = buildMeshFromObstacles(this.staticObstacles, DEFAULT_CITY_BOUNDS);
    }

    const positions =
      meshData.positions instanceof Float32Array
        ? meshData.positions
        : new Float32Array(meshData.positions);

    const indices =
      meshData.indices instanceof Uint32Array
        ? meshData.indices
        : new Uint32Array(meshData.indices);

    const generatorResult = generateSoloNavMesh(positions, indices, {
      ...soloNavMeshGeneratorConfigDefaults,
      cs: 0.25,
      ch: 0.2,
      walkableHeight: 2.0,
      walkableRadius: 0.6,
      walkableClimb: 0.5,
      maxEdgeLen: 12,
    });

    if (generatorResult.success && generatorResult.navMesh) {
      this.navMesh = generatorResult.navMesh;
      this.navMeshQuery = new NavMeshQuery(this.navMesh);
      this.initialized = true;
    } else {
      throw new Error(`Falha ao gerar NavMesh no Recast: ${generatorResult.error ?? 'Unknown error'}`);
    }
  }

  /**
   * Atualiza o estado do semáforo veicular do cruzamento municipal.
   */
  setTrafficLightState(state: 'red' | 'yellow' | 'green'): void {
    this.currentTrafficLightState = state;
  }

  getTrafficLightState(): 'red' | 'yellow' | 'green' {
    return this.currentTrafficLightState;
  }

  /**
   * Adiciona um obstáculo dinâmico temporário (ex: veículo avariado, entulho, obra).
   */
  addDynamicObstacle(obstacle: DynamicObstacle): void {
    this.dynamicObstacles.set(obstacle.id, obstacle);
  }

  removeDynamicObstacle(id: string): void {
    this.dynamicObstacles.delete(id);
  }

  /**
   * Valida se um ponto 3D é navegável e livre de colisões com edifícios e obstáculos.
   */
  isNavigable(point: Vector3Like, maxDistance = 0.8): boolean {
    // 1. Verificação contra obstáculos estáticos (edifícios, fontes)
    if (this.isInsideObstacle(point)) {
      return false;
    }

    // 2. Verificação contra obstáculos dinâmicos (veículos)
    if (this.isInsideDynamicObstacle(point)) {
      return false;
    }

    // 3. Verificação contra a NavMesh
    if (this.navMeshQuery) {
      try {
        const closest = this.navMeshQuery.findClosestPoint(point);
        if (closest.success && closest.point) {
          const dx = closest.point.x - point.x;
          const dy = closest.point.y - point.y;
          const dz = closest.point.z - point.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return dist <= maxDistance;
        }
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Encontra o ponto válido mais próximo na NavMesh.
   */
  getClosestPoint(point: Vector3Like): Vector3Like | null {
    if (!this.navMeshQuery) return null;
    try {
      const result = this.navMeshQuery.findClosestPoint(point);
      return result.success && result.point ? result.point : null;
    } catch {
      return null;
    }
  }

  /**
   * Calcula o caminho ótimo entre dois pontos via NavMesh Recast.
   * Respeita obstáculos físicos e recalcula rotas quando o semáforo fecha a faixa.
   */
  findPath(
    from: Vector3Like,
    to: Vector3Like,
    options?: PathfindingOptions,
  ): PathfindingResult {
    if (!this.initialized || !this.navMeshQuery) {
      // Fallback determinístico caso ainda não inicializado
      return {
        success: true,
        waypoints: [{ ...from }, { ...to }],
        distance: this.distanceBetween(from, to),
        crosswalkIncluded: false,
      };
    }

    const trafficState = options?.trafficLightState ?? this.currentTrafficLightState;
    const isPedestrianRed = trafficState === 'green'; // Semáforo verde para carros = pedestres aguardam

    // Verifica se a rota pretendida cruza a via na altura da faixa de pedestres central (eixo X atravessando Avenida Central)
    const crossesRoadway = (from.x < 0 && to.x > 0) || (from.x > 0 && to.x < 0);
    const inCrosswalkLatitude =
      (from.z >= -14 && from.z <= -6) ||
      (to.z >= -14 && to.z <= -6) ||
      (from.z >= 6 && from.z <= 14) ||
      (to.z >= 6 && to.z <= 14);

    let effectiveTarget = to;
    let recalculatedDueToSignal = false;
    let crosswalkIncluded = false;

    // Se o semáforo estiver verde para veículos e o agente tentar atravessar a faixa:
    // Rota é recalculada para pará-lo na calçada de espera antes da faixa
    if (isPedestrianRed && crossesRoadway && inCrosswalkLatitude) {
      recalculatedDueToSignal = true;
      const safeWaitingX = from.x < 0 ? -8.0 : 8.0;
      const waitingZ = from.z < 0 ? -10.0 : 10.0;
      effectiveTarget = { x: safeWaitingX, y: 0.1, z: waitingZ };
    } else if (crossesRoadway && inCrosswalkLatitude) {
      crosswalkIncluded = true;
    }

    // Calcula rota na NavMesh do Recast
    try {
      const startPoint = this.getClosestPoint(from) ?? from;
      const endPoint = this.getClosestPoint(effectiveTarget) ?? effectiveTarget;

      const pathResult = this.navMeshQuery.computePath(startPoint, endPoint);

      if (pathResult.success && pathResult.path.length > 0) {
        // Assegura que nenhum ponto atravesse o centro de obstáculos estáticos
        const validatedWaypoints = this.filterObstaclePenetrations(pathResult.path);

        return {
          success: true,
          waypoints: validatedWaypoints,
          distance: this.calculatePathDistance(validatedWaypoints),
          crosswalkIncluded: crosswalkIncluded && !recalculatedDueToSignal,
          recalculatedDueToSignal,
        };
      }
    } catch {
      // Em caso de falha de consulta, devolve waypoints diretos com validação
    }

    return {
      success: false,
      waypoints: [{ ...from }, { ...effectiveTarget }],
      distance: this.distanceBetween(from, effectiveTarget),
      crosswalkIncluded: false,
      recalculatedDueToSignal,
    };
  }

  /**
   * Checa se o ponto está estritamente dentro de algum obstáculo estático.
   */
  private isInsideObstacle(point: Vector3Like, margin = 0.05): boolean {
    for (const obs of this.staticObstacles) {
      if (obs.type === 'cylinder' || ('cx' in obs && 'radius' in obs)) {
        const dx = point.x - obs.cx;
        const dz = point.z - obs.cz;
        const r = obs.radius - margin;
        if (dx * dx + dz * dz < r * r) {
          return true;
        }
      } else {
        if (
          point.x > obs.minX + margin &&
          point.x < obs.maxX - margin &&
          point.z > obs.minZ + margin &&
          point.z < obs.maxZ - margin
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Checa se o ponto está dentro de algum obstáculo dinâmico (ex: veículo).
   */
  private isInsideDynamicObstacle(point: Vector3Like): boolean {
    for (const obs of this.dynamicObstacles.values()) {
      if (obs.type === 'cylinder' && obs.radius) {
        const dx = point.x - obs.position.x;
        const dz = point.z - obs.position.z;
        if (dx * dx + dz * dz <= obs.radius * obs.radius) {
          return true;
        }
      } else if (obs.size) {
        const halfX = obs.size.x / 2;
        const halfZ = obs.size.z / 2;
        if (
          point.x >= obs.position.x - halfX &&
          point.x <= obs.position.x + halfX &&
          point.z >= obs.position.z - halfZ &&
          point.z <= obs.position.z + halfZ
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private filterObstaclePenetrations(path: Vector3Like[]): Vector3Like[] {
    return path.map((pt) => {
      if (this.isInsideObstacle(pt)) {
        const snapped = this.getClosestPoint(pt);
        return snapped ?? pt;
      }
      return pt;
    });
  }

  private distanceBetween(a: Vector3Like, b: Vector3Like): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculatePathDistance(waypoints: Vector3Like[]): number {
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      total += this.distanceBetween(waypoints[i], waypoints[i + 1]);
    }
    return Number(total.toFixed(2));
  }
}
