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
});
