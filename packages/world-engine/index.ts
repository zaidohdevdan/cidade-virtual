// packages/world-engine/index.ts
// SYNAPSE CITY ENGINE — Estado autoritativo do mundo, ambiente e navegação espacial

import type { GeoCoords } from '@cidade-virtual/types';

export * from './types.js';
export * from './geometry-builder.js';
export * from './navigation.service.js';

export class WorldStateManager {
  private timeOfDay: number = 12;
  private weather: string = 'clear';

  getState() {
    return { timeOfDay: this.timeOfDay, weather: this.weather };
  }
}

export class SpatialQueryService {
  isWithinRadius(a: GeoCoords, b: GeoCoords, radius: number): boolean {
    const dx = a.lat - b.lat;
    const dz = a.lng - b.lng;
    return Math.sqrt(dx * dx + dz * dz) <= radius;
  }
}
