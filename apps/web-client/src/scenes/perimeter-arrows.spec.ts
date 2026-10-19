import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CityScene } from './city-scene';

describe('Perimeter Road Directional Arrows (Unit Tests — Web Client)', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 1024,
            height: 256,
            getContext: () => ({
              fillStyle: '',
              fillRect: () => {},
              font: '',
              textAlign: '',
              textBaseline: '',
              fillText: () => {},
              strokeStyle: '',
              lineWidth: 0,
              strokeRect: () => {},
              roundRect: () => {},
              fill: () => {},
              stroke: () => {},
              beginPath: () => {},
              closePath: () => {},
              arc: () => {},
              moveTo: () => {},
              lineTo: () => {},
            }),
          };
        }
        return { style: {} };
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('as setas da Perimetral Sul e Norte devem apontar estritamente no sentido do fluxo CTB', () => {
    const city = new CityScene();

    // Extrai todos os grupos que contêm as setas direcionais
    const arrowGroups: THREE.Group[] = [];
    city.scene.traverse((obj) => {
      if (obj instanceof THREE.Group && obj.children.length === 1 && obj.children[0] instanceof THREE.Mesh) {
        const mesh = obj.children[0] as THREE.Mesh;
        if (mesh.geometry instanceof THREE.ShapeGeometry) {
          arrowGroups.push(obj);
        }
      }
    });

    // 1. Perimetral Sul (z = +68):
    // Pista externa (z = +71.5): fluxo para o LESTE (+X, rotY = Math.PI / 2)
    const southEastArrows = arrowGroups.filter((g) => Math.abs(g.position.z - 71.5) < 0.2);
    expect(southEastArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of southEastArrows) {
      expect(arrow.rotation.y).toBeCloseTo(Math.PI / 2);
    }

    // Pista interna (z = +64.5): fluxo para o OESTE (-X, rotY = -Math.PI / 2)
    const southWestArrows = arrowGroups.filter((g) => Math.abs(g.position.z - 64.5) < 0.2);
    expect(southWestArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of southWestArrows) {
      expect(arrow.rotation.y).toBeCloseTo(-Math.PI / 2);
    }

    // 2. Perimetral Norte (z = -68):
    // Pista externa (z = -71.5): fluxo para o OESTE (-X, rotY = -Math.PI / 2)
    const northWestArrows = arrowGroups.filter((g) => Math.abs(g.position.z - (-71.5)) < 0.2);
    expect(northWestArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of northWestArrows) {
      expect(arrow.rotation.y).toBeCloseTo(-Math.PI / 2);
    }

    // Pista interna (z = -64.5): fluxo para o LESTE (+X, rotY = Math.PI / 2)
    const northEastArrows = arrowGroups.filter((g) => Math.abs(g.position.z - (-64.5)) < 0.2);
    expect(northEastArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of northEastArrows) {
      expect(arrow.rotation.y).toBeCloseTo(Math.PI / 2);
    }
  });

  it('as setas da Perimetral Oeste e Leste devem apontar estritamente no sentido do fluxo CTB', () => {
    const city = new CityScene();

    const arrowGroups: THREE.Group[] = [];
    city.scene.traverse((obj) => {
      if (obj instanceof THREE.Group && obj.children.length === 1 && obj.children[0] instanceof THREE.Mesh) {
        const mesh = obj.children[0] as THREE.Mesh;
        if (mesh.geometry instanceof THREE.ShapeGeometry) {
          arrowGroups.push(obj);
        }
      }
    });

    // 1. Perimetral Oeste (x = -68):
    // Pista externa (x = -71.5): fluxo para o SUL (+Z, rotY = 0)
    const westSouthArrows = arrowGroups.filter((g) => Math.abs(g.position.x - (-71.5)) < 0.2);
    expect(westSouthArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of westSouthArrows) {
      expect(arrow.rotation.y).toBeCloseTo(0);
    }

    // Pista interna (x = -64.5): fluxo para o NORTE (-Z, rotY = Math.PI)
    const westNorthArrows = arrowGroups.filter((g) => Math.abs(g.position.x - (-64.5)) < 0.2);
    expect(westNorthArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of westNorthArrows) {
      expect(arrow.rotation.y).toBeCloseTo(Math.PI);
    }

    // 2. Perimetral Leste (x = +68):
    // Pista externa (x = +71.5): fluxo para o NORTE (-Z, rotY = Math.PI)
    const eastNorthArrows = arrowGroups.filter((g) => Math.abs(g.position.x - 71.5) < 0.2);
    expect(eastNorthArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of eastNorthArrows) {
      expect(arrow.rotation.y).toBeCloseTo(Math.PI);
    }

    // Pista interna (x = +64.5): fluxo para o SUL (+Z, rotY = 0)
    const eastSouthArrows = arrowGroups.filter((g) => Math.abs(g.position.x - 64.5) < 0.2);
    expect(eastSouthArrows.length).toBeGreaterThanOrEqual(2);
    for (const arrow of eastSouthArrows) {
      expect(arrow.rotation.y).toBeCloseTo(0);
    }
  });
});
