// packages/world-engine/types.ts
// Tipos canônicos de Navegação Espacial, Geometria e NavMesh

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface NavMeshGeometryInput {
  positions: Float32Array | number[];
  indices: Uint32Array | number[];
}

export interface ObstacleBox {
  type?: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  name?: string;
}

export interface ObstacleCylinder {
  type?: 'cylinder';
  cx: number;
  cz: number;
  radius: number;
  minY?: number;
  maxY?: number;
  name?: string;
}

export type SceneObstacle = ObstacleBox | ObstacleCylinder;

export interface DynamicObstacle {
  id: string;
  type: 'box' | 'cylinder';
  position: Vector3Like;
  size?: Vector3Like;
  radius?: number;
  name?: string;
}

export interface PathfindingOptions {
  avoidClosedCrosswalk?: boolean;
  trafficLightState?: 'red' | 'yellow' | 'green';
  maxDetourDistance?: number;
  checkCollisionWithObstacles?: boolean;
}

export interface PathfindingResult {
  success: boolean;
  waypoints: Vector3Like[];
  distance: number;
  crosswalkIncluded: boolean;
  recalculatedDueToSignal?: boolean;
}
