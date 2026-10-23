import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DanielAvatar } from './daniel-avatar';

describe('DanielAvatar — Locomoção Urbana e Acesso ao Anel Viário Perimetral', () => {
  let player: DanielAvatar;

  beforeEach(() => {
    (globalThis as any).document = {
      createElement: () => ({
        style: {},
        innerHTML: '',
        parentNode: null,
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
        contains: () => false,
      },
    };
    player = new DanielAvatar();
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('Daniel deve iniciar na calçada e transitar livremente além da antiga barreira de 58m até a Perimetral Sul (z >= 70m)', () => {
    expect(player.position.x).toBeCloseTo(8.5);
    expect(player.position.z).toBeCloseTo(12.0);

    const stepDelta = 0.05;
    // Move continuamente para trás (Sul, +Z) com sprint ativado
    for (let i = 0; i < 300; i++) {
      player.update(stepDelta, { forward: false, backward: true, left: false, right: false, sprint: true }, 0, []);
    }

    // Deve ter ultrapassado a antiga barreira invisível de 58m e alcançado o Anel Viário Sul (>= 70m)
    expect(player.position.z).toBeGreaterThan(58);
    expect(player.position.z).toBeGreaterThanOrEqual(70);
    expect(player.position.z).toBeLessThanOrEqual(82);
  });

  it('Daniel deve transitar livremente em direção ao Leste (+X) e alcançar a Perimetral Leste (x >= 70m)', () => {
    const stepDelta = 0.05;
    // Move continuamente para a direita (Leste, +X) com sprint ativado
    for (let i = 0; i < 300; i++) {
      player.update(stepDelta, { forward: false, backward: false, left: false, right: true, sprint: true }, 0, []);
    }

    expect(player.position.x).toBeGreaterThan(58);
    expect(player.position.x).toBeGreaterThanOrEqual(70);
    expect(player.position.x).toBeLessThanOrEqual(82);
  });

  it('Daniel deve ser construído como avatar limpo, sem luzes móveis (PointLight ou DirectionalLight) anexadas à malha para não poluir reflexos no cenário', () => {
    let hasPointLight = false;
    let hasDirectionalLight = false;
    player.mesh.traverse((child) => {
      if ((child as any).isPointLight) {
        hasPointLight = true;
      }
      if ((child as any).isDirectionalLight) {
        hasDirectionalLight = true;
      }
    });
    // Garante que o avatar não carrega fontes de luz que perturbem o mundo ou gerem reflexos a cada passo
    expect(hasPointLight).toBe(false);
    expect(hasDirectionalLight).toBe(false);
  });

  it('deve possuir os pilares visuais canônicos: óculos com lente translúcida, highlight de olho (1 draw call) e sombra de contato', () => {
    let hasEyeHighlight = false;
    let hasTranslucentLens = false;
    let hasContactShadow = false;

    player.mesh.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as any;
        const mat = mesh.material;

        // Verifica o brilho branco no olho (MeshBasicMaterial branco)
        if (mat?.isMeshBasicMaterial && mat?.color?.getHexString() === 'ffffff' && mesh.geometry?.type === 'SphereGeometry') {
          hasEyeHighlight = true;
        }

        // Verifica lente translúcida dos óculos
        if (mat?.transparent && mat?.opacity < 0.5 && mat?.roughness <= 0.2) {
          hasTranslucentLens = true;
        }

        // Verifica sombra de contato no plano do piso
        if (mesh.geometry?.type === 'PlaneGeometry' && mesh.rotation.x === -Math.PI / 2) {
          hasContactShadow = true;
        }
      }
    });

    // 1. Olho com highlight vivo de MeshBasicMaterial branco (1 draw call)
    expect(hasEyeHighlight).toBe(true);
    // 2. Óculos de verdade com lente translúcida
    expect(hasTranslucentLens).toBe(true);
    // 3. Sombra de contato no piso
    expect(hasContactShadow).toBe(true);
  });
});
