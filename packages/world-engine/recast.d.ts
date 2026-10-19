// packages/world-engine/recast.d.ts
// Declarações de tipo para recast-navigation e @recast-navigation/generators sob NodeNext

declare module 'recast-navigation' {
  export function init(): Promise<void>;

  export class NavMesh {
    constructor();
    destroy(): void;
  }

  export interface ComputePathResult {
    success: boolean;
    path: Array<{ x: number; y: number; z: number }>;
  }

  export interface FindClosestPointResult {
    success: boolean;
    point?: { x: number; y: number; z: number };
  }

  export class NavMeshQuery {
    constructor(navMesh: NavMesh);
    computePath(
      start: { x: number; y: number; z: number },
      end: { x: number; y: number; z: number },
    ): ComputePathResult;
    findClosestPoint(point: { x: number; y: number; z: number }): FindClosestPointResult;
    destroy(): void;
  }
}

declare module '@recast-navigation/generators' {
  import type { NavMesh } from 'recast-navigation';

  export interface SoloNavMeshGeneratorConfig {
    cs?: number;
    ch?: number;
    walkableSlopeAngle?: number;
    walkableHeight?: number;
    walkableClimb?: number;
    walkableRadius?: number;
    maxEdgeLen?: number;
    maxSimplificationError?: number;
    minRegionArea?: number;
    mergeRegionArea?: number;
    maxVertsPerPoly?: number;
    detailSampleDist?: number;
    detailSampleMaxError?: number;
    borderSize?: number;
    tileSize?: number;
  }

  export const soloNavMeshGeneratorConfigDefaults: SoloNavMeshGeneratorConfig;

  export interface SoloNavMeshResult {
    success: boolean;
    navMesh?: NavMesh;
    error?: string;
  }

  export function generateSoloNavMesh(
    positions: Float32Array,
    indices: Uint32Array,
    config?: SoloNavMeshGeneratorConfig,
  ): SoloNavMeshResult;
}
