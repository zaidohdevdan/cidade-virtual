// packages/world-engine/geometry-builder.ts
// Construtor procedural de geometria de solo e obstáculos para Recast NavMesh

import type { NavMeshGeometryInput, SceneObstacle, ObstacleBox } from './types.js';

export interface CityGeometryBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_CITY_BOUNDS: CityGeometryBounds = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50,
};

/**
 * Constrói buffers de posições e índices triangulares compatíveis com Recast.
 */
export function buildMeshFromObstacles(
  obstacles: SceneObstacle[],
  bounds: CityGeometryBounds = DEFAULT_CITY_BOUNDS,
): NavMeshGeometryInput {
  const positions: number[] = [];
  const indices: number[] = [];

  function addQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
  ) {
    const base = positions.length / 3;
    positions.push(...p0, ...p1, ...p2, ...p3);
    // Winding counter-clockwise
    indices.push(base, base + 2, base + 1);
    indices.push(base, base + 3, base + 2);
  }

  // 1. Chão navegável principal
  const { minX, maxX, minZ, maxZ } = bounds;
  addQuad([minX, 0, minZ], [maxX, 0, minZ], [maxX, 0, maxZ], [minX, 0, maxZ]);

  // 2. Obstáculos sólidos (paredes verticais íngremes e telhado)
  for (const obs of obstacles) {
    let bMinX = 0;
    let bMaxX = 0;
    let bMinZ = 0;
    let bMaxZ = 0;
    const height = obs.maxY ? obs.maxY - (obs.minY ?? 0) : 6.0;
    const groundY = obs.minY ?? 0.0;

    if (obs.type === 'cylinder' || ('cx' in obs && 'radius' in obs)) {
      const cx = obs.cx;
      const cz = obs.cz;
      const r = obs.radius;
      bMinX = cx - r;
      bMaxX = cx + r;
      bMinZ = cz - r;
      bMaxZ = cz + r;
    } else {
      bMinX = obs.minX;
      bMaxX = obs.maxX;
      bMinZ = obs.minZ;
      bMaxZ = obs.maxZ;
    }

    const topY = groundY + height;

    // Parede Sul
    addQuad([bMinX, groundY, bMaxZ], [bMaxX, groundY, bMaxZ], [bMaxX, topY, bMaxZ], [bMinX, topY, bMaxZ]);
    // Parede Norte
    addQuad([bMaxX, groundY, bMinZ], [bMinX, groundY, bMinZ], [bMinX, topY, bMinZ], [bMaxX, topY, bMinZ]);
    // Parede Oeste
    addQuad([bMinX, groundY, bMinZ], [bMinX, groundY, bMinZ], [bMinX, topY, bMaxZ], [bMinX, topY, bMinZ]);
    // Parede Leste
    addQuad([bMaxX, groundY, bMaxZ], [bMaxX, groundY, bMinZ], [bMaxX, topY, bMinZ], [bMaxX, topY, bMaxZ]);
    // Topo (telhado sólido)
    addQuad([bMinX, topY, bMinZ], [bMaxX, topY, bMinZ], [bMaxX, topY, bMaxZ], [bMinX, topY, bMaxZ]);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

/**
 * Conjunto de obstáculos padrão da Synapse City (Avenida Central + Cruzamento + Prédios + Praça)
 */
export const SYNAPSE_CITY_STATIC_OBSTACLES: ObstacleBox[] = [
  // Quarteirão Noroeste (Mercado e Comércio)
  { minX: -35, maxX: -15, minZ: -35, maxZ: -15, name: 'Mercado_Municipal' },
  // Quarteirão Nordeste (Edifício Residencial e Escritórios)
  { minX: 15, maxX: 35, minZ: -35, maxZ: -15, name: 'Edificio_Norte' },
  // Quarteirão Sudeste (Café e Restaurante)
  { minX: 15, maxX: 35, minZ: 15, maxZ: 35, name: 'Cafe_Avenida' },
  // Quarteirão Sudoeste (Bancos e Fonte Monumental da Praça Central)
  { minX: -25, maxX: -15, minZ: 15, maxZ: 25, name: 'Praca_Monumento_Fonte' },
];
