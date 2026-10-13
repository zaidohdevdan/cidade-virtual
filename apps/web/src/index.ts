// apps/web/src/index.ts
import * as THREE from 'three';

export function createVirtualCityScene(): { scene: THREE.Scene; status: string } {
  // TODO: configurar cena Three.js, iluminação, skybox e malha urbana
  const scene = new THREE.Scene();
  return { scene, status: 'ready' };
}
