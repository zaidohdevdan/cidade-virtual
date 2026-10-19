import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CityScene } from './city-scene';

describe('CityScene — Sinalização Viária e Mão de Direção Brasileira (CTB / CONTRAN)', () => {
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
  it('deve instanciar a cena urbana e conter o cruzamento central', () => {
    const city = new CityScene();
    expect(city.scene).toBeDefined();
    expect(city.trafficLights.length).toBe(4);
    expect(city.interactiveObjects.length).toBeGreaterThan(0);
  });

  it('as 4 linhas de retenção (LRE) devem estar posicionadas estritamente nas faixas de aproximação da mão direita brasileira', () => {
    const city = new CityScene();

    // Filtra objetos da cena que representam linhas de retenção (BoxGeometry com dimensões de LRE)
    const stopLines: THREE.Mesh[] = [];
    city.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
        const { width, depth } = child.geometry.parameters;
        // LRE: largura 6.6m e profundidade 0.45m (ou invertido na transversal)
        if ((Math.abs(width - 6.6) < 0.1 && Math.abs(depth - 0.45) < 0.1) ||
            (Math.abs(width - 0.45) < 0.1 && Math.abs(depth - 6.6) < 0.1)) {
          stopLines.push(child);
        }
      }
    });

    expect(stopLines).toHaveLength(4);

    // 1. Pista Norte descendo para o Sul (+Z): faixa da direita em x < 0 (x = -3.5), antes do cruzamento (z = -12.5)
    const northStop = stopLines.find((m) => Math.abs(m.position.z - (-12.5)) < 0.2);
    expect(northStop).toBeDefined();
    expect(northStop!.position.x).toBeCloseTo(-3.5);

    // 2. Pista Sul subindo para o Norte (-Z): faixa da direita em x > 0 (x = +3.5), antes do cruzamento (z = +12.5)
    const southStop = stopLines.find((m) => Math.abs(m.position.z - 12.5) < 0.2);
    expect(southStop).toBeDefined();
    expect(southStop!.position.x).toBeCloseTo(3.5);

    // 3. Pista Oeste indo para o Leste (+X): faixa da direita em z > 0 (z = +3.5), antes do cruzamento (x = -12.5)
    const westStop = stopLines.find((m) => Math.abs(m.position.x - (-12.5)) < 0.2);
    expect(westStop).toBeDefined();
    expect(westStop!.position.z).toBeCloseTo(3.5);

    // 4. Pista Leste indo para o Oeste (-X): faixa da direita em z < 0 (z = -3.5), antes do cruzamento (x = +12.5)
    const eastStop = stopLines.find((m) => Math.abs(m.position.x - 12.5) < 0.2);
    expect(eastStop).toBeDefined();
    expect(eastStop!.position.z).toBeCloseTo(-3.5);
  });

  it('deve possuir faixas de travessia zebradas nos 4 acessos do cruzamento', () => {
    const city = new CityScene();
    const crosswalks = city.interactiveObjects.filter((o) => o.type === 'crosswalk');
    expect(crosswalks).toHaveLength(4);

    const names = crosswalks.map((c) => c.name);
    expect(names.some((n) => n.includes('Norte'))).toBe(true);
    expect(names.some((n) => n.includes('Sul'))).toBe(true);
    expect(names.some((n) => n.includes('Leste'))).toBe(true);
    expect(names.some((n) => n.includes('Oeste'))).toBe(true);
  });
});
