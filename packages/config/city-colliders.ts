// packages/config/city-colliders.ts
import { OPERATIONAL_LIMITS } from './limits';

export interface ObstacleCollider {
  type: 'box' | 'cylinder';
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  cx?: number;
  cz?: number;
  radius?: number;
  name?: string;
}

export interface CityBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export const CITY_BOUNDS: CityBounds = {
  minX: -65,
  maxX: 65,
  minZ: -65,
  maxZ: 65,
  minY: -1,
  maxY: 25,
};

/**
 * Colisores físicos estáticos da Synapse City (DENATRAN 3D).
 * Espelho autoritativo compartilhado entre o backend e a cena gráfica.
 */
export const CITY_STATIC_COLLIDERS: ObstacleCollider[] = [
  // ── Edifícios Urbanos (Paredes estáticas densas) ──
  {
    type: 'box',
    minX: -40.3,
    maxX: -15.7,
    minZ: 15.7,
    maxZ: 40.3,
    name: 'Edifício Noroeste',
  },
  {
    type: 'box',
    minX: -39.3,
    maxX: -16.7,
    minZ: -41.3,
    maxZ: -14.7,
    name: 'Edifício Sudoeste',
  },
  {
    type: 'box',
    minX: 14.7,
    maxX: 41.3,
    minZ: -39.3,
    maxZ: -16.7,
    name: 'Edifício Sudeste',
  },
  {
    type: 'box',
    minX: 35.7,
    maxX: 54.3,
    minZ: 17.7,
    maxZ: 38.3,
    name: 'Edifício Nordeste',
  },

  // ── Praça Central e Estruturas Urbanas ──
  {
    type: 'box',
    minX: 12.0,
    maxX: 38.0,
    minZ: 37.6,
    maxZ: 38.4,
    name: 'Mureta Sul da Praça',
  },
  {
    type: 'box',
    minX: 16.4,
    maxX: 21.6,
    minZ: 16.4,
    maxZ: 21.6,
    name: 'Canteiro Noroeste da Praça',
  },
  {
    type: 'box',
    minX: 28.4,
    maxX: 33.6,
    minZ: 16.4,
    maxZ: 21.6,
    name: 'Canteiro Nordeste da Praça',
  },
  {
    type: 'box',
    minX: 16.4,
    maxX: 21.6,
    minZ: 28.4,
    maxZ: 33.6,
    name: 'Canteiro Sudoeste da Praça',
  },
  {
    type: 'box',
    minX: 28.4,
    maxX: 33.6,
    minZ: 28.4,
    maxZ: 33.6,
    name: 'Canteiro Sudeste da Praça',
  },
  {
    type: 'cylinder',
    cx: 25.0,
    cz: 25.0,
    radius: 2.75,
    name: 'Fonte Monumental da Praça',
  },
  {
    type: 'box',
    minX: 19.0,
    maxX: 21.0,
    minZ: 24.3,
    maxZ: 25.7,
    name: 'Banco da Praça (Oeste)',
  },
  {
    type: 'box',
    minX: 29.0,
    maxX: 31.0,
    minZ: 24.3,
    maxZ: 25.7,
    name: 'Banco da Praça (Leste)',
  },

  // ── Ponto de Ônibus e Veículo ──
  {
    type: 'box',
    minX: -13.3,
    maxX: -11.2,
    minZ: -21.7,
    maxZ: -18.3,
    name: 'Ponto de Ônibus',
  },
  {
    type: 'box',
    minX: 6.7,
    maxX: 9.3,
    minZ: -38.5,
    maxZ: -33.5,
    name: 'Veículo Estacionado',
  },

  // ── Semáforos do Cruzamento ──
  { type: 'cylinder', cx: -7.5, cz: 7.5, radius: 0.45, name: 'Semáforo NW' },
  { type: 'cylinder', cx: 7.5, cz: -7.5, radius: 0.45, name: 'Semáforo SE' },
  { type: 'cylinder', cx: 7.5, cz: 7.5, radius: 0.45, name: 'Semáforo NE' },
  { type: 'cylinder', cx: -7.5, cz: -7.5, radius: 0.45, name: 'Semáforo SW' },
];

export interface PositionPoint {
  x: number;
  y: number;
  z: number;
  timestamp?: number;
}

export interface MovementValidationResult {
  valid: boolean;
  reason?: string;
  colliderName?: string;
}

/**
 * Verifica se um ponto 2D (x, z) colide com algum obstáculo estático.
 */
export function checkPointCollision(
  x: number,
  z: number,
  colliders: ObstacleCollider[] = CITY_STATIC_COLLIDERS,
  padding: number = 0.1,
): { collides: boolean; collider?: ObstacleCollider } {
  for (const c of colliders) {
    if (c.type === 'box') {
      if (
        c.minX !== undefined &&
        c.maxX !== undefined &&
        c.minZ !== undefined &&
        c.maxZ !== undefined
      ) {
        if (
          x >= c.minX - padding &&
          x <= c.maxX + padding &&
          z >= c.minZ - padding &&
          z <= c.maxZ + padding
        ) {
          return { collides: true, collider: c };
        }
      }
    } else if (c.type === 'cylinder') {
      if (c.cx !== undefined && c.cz !== undefined && c.radius !== undefined) {
        const dx = x - c.cx;
        const dz = z - c.cz;
        const distSq = dx * dx + dz * dz;
        const effectiveRadius = c.radius + padding;
        if (distSq <= effectiveRadius * effectiveRadius) {
          return { collides: true, collider: c };
        }
      }
    }
  }
  return { collides: false };
}

/**
 * Validação física server-side de movimentação de avatar (Task-022).
 * Rejeita:
 * 1. Fora dos limites da cidade.
 * 2. Posição final dentro de colisor de edifício/obstáculo.
 * 3. Teletransporte através de parede (raycast por amostragem entre posições).
 * 4. Velocidade instantânea superior ao limite físico factível (maxAvatarSpeedMps).
 * 5. Pulos anômalos de teletransporte (> 20m sem justificativa).
 */
export function validateAvatarMovement(
  prev: PositionPoint | undefined,
  next: PositionPoint,
  nowMs: number = Date.now(),
): MovementValidationResult {
  // 1. Limites do mundo
  if (
    next.x < CITY_BOUNDS.minX ||
    next.x > CITY_BOUNDS.maxX ||
    next.z < CITY_BOUNDS.minZ ||
    next.z > CITY_BOUNDS.maxZ ||
    next.y < CITY_BOUNDS.minY ||
    next.y > CITY_BOUNDS.maxY
  ) {
    return {
      valid: false,
      reason: `OUT_OF_BOUNDS: Posição (${next.x.toFixed(1)}, ${next.z.toFixed(1)}) excede os limites da cidade`,
    };
  }

  // 2. Colisão direta na posição de destino
  const directCollision = checkPointCollision(next.x, next.z);
  if (directCollision.collides) {
    return {
      valid: false,
      reason: `COLLISION_DETECTED: Ponto de destino colide com obstáculo '${directCollision.collider?.name}'`,
      colliderName: directCollision.collider?.name,
    };
  }

  // Se não há histórico anterior (primeira posição recebida pelo socket), é aceita se não colidir
  if (!prev) {
    return { valid: true };
  }

  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dz = next.z - prev.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // 3. Verificação de atravessamento de parede (Wall Phasing / Clipping)
  // Amostra pontos intermediários ao longo do segmento de deslocamento
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sampleX = prev.x + dx * t;
    const sampleZ = prev.z + dz * t;
    const intermediateCollision = checkPointCollision(sampleX, sampleZ);
    if (intermediateCollision.collides) {
      return {
        valid: false,
        reason: `WALL_PHASING_REJECTED: Trajetória atravessa obstáculo '${intermediateCollision.collider?.name}'`,
        colliderName: intermediateCollision.collider?.name,
      };
    }
  }

  // 4. Verificação de salto excessivo (teletransporte)
  const maxInstantJump = 20.0; // metros
  if (dist > maxInstantJump) {
    return {
      valid: false,
      reason: `TELEPORT_REJECTED: Deslocamento instantâneo de ${dist.toFixed(1)}m excede o limite máximo permitido (${maxInstantJump}m)`,
    };
  }

  // 5. Verificação de velocidade física
  const prevTime = prev.timestamp ?? nowMs - 50;
  const dtSeconds = Math.max(0.01, (nowMs - prevTime) / 1000);
  const speed = dist / dtSeconds;

  if (speed > OPERATIONAL_LIMITS.maxAvatarSpeedMps && dist > 1.5) {
    return {
      valid: false,
      reason: `MAX_SPEED_EXCEEDED: Velocidade calculada de ${speed.toFixed(1)} m/s excede a velocidade máxima de ${OPERATIONAL_LIMITS.maxAvatarSpeedMps} m/s`,
    };
  }

  return { valid: true };
}
