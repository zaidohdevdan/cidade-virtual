import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { AgentAvatar, CITY_AGENTS } from './agent-avatar';

describe('AgentAvatar & CITY_AGENTS (Unit Test — Web Client)', () => {
  let agent: AgentAvatar;
  let bodyChildren: any[] = [];

  beforeEach(() => {
    bodyChildren = [];
    (globalThis as any).document = {
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          style: {},
          innerHTML: '',
          parentNode: null,
        };
        return el;
      },
      body: {
        appendChild: (child: any) => {
          child.parentNode = (globalThis as any).document.body;
          bodyChildren.push(child);
          return child;
        },
        removeChild: (child: any) => {
          child.parentNode = null;
          const idx = bodyChildren.indexOf(child);
          if (idx >= 0) bodyChildren.splice(idx, 1);
        },
        contains: (child: any) => child?.parentNode === (globalThis as any).document.body,
      },
    };

    const config = CITY_AGENTS.find((a) => a.id === 'agent-vega')!;
    agent = new AgentAvatar(config);
  });

  afterEach(() => {
    agent.dispose();
  });

  it('deve possuir exatamente os 7 cidadãos estelares inspirados na Constelação de Lira', () => {
    expect(CITY_AGENTS).toHaveLength(7);

    const names = CITY_AGENTS.map((a) => a.name);
    expect(names).toContain('Vega');
    expect(names).toContain('Sulafat');
    expect(names).toContain('Sheliak');
    expect(names).toContain('Epsilon');
    expect(names).toContain('Aladfar');
    expect(names).toContain('Xihe');
    expect(names).toContain('Chasoň');
  });

  it('todos os agentes devem possuir IDs únicos, designações estelares e pontos de patrulha válidos', () => {
    const ids = new Set<string>();

    for (const a of CITY_AGENTS) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);

      expect(a.starDesignation).toBeDefined();
      expect(a.role).toBeDefined();
      expect(a.startPosition).toBeDefined();
      expect(a.patrolPoints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('deve emitir balão de fala estilizado através do método say() (Task-026)', () => {
    agent.say('Avenida limpa e fluxo seguro!');

    expect(agent.speechTimer).toBe(4.0);
    expect(agent.speechBubble).toBeDefined();
    expect(agent.speechBubble?.innerHTML).toContain('Avenida limpa e fluxo seguro!');
    expect(agent.speechBubble?.innerHTML).toContain('Vega');
    expect(document.body.contains(agent.speechBubble!)).toBe(true);
  });

  it('deve aceitar novo destino server-side via setTargetPosition() e atualizar rota', () => {
    const dest = { x: 12.0, y: 0.19, z: -15.0 };
    agent.setTargetPosition(dest);

    expect(agent.targetPosition).not.toBeNull();
    expect(agent.targetPosition?.x).toBe(12.0);
    expect(agent.targetPosition?.z).toBe(-15.0);

    // Executa update simulado
    agent.update(0.1, [], 'green');
    expect(agent.targetPosition).not.toBeNull(); // Ainda navegando em direção ao destino

    // Interrompe movimento
    agent.stopMovement();
    expect(agent.targetPosition).toBeNull();
    expect(agent.speed).toBe(0);
  });

  it('deve aguardar na calçada quando estiver próximo à faixa central e o semáforo veicular estiver verde', () => {
    // Posiciona o agente na aproximação da faixa de pedestres central
    agent.position.set(0, 0.19, 2.0);
    agent.update(0.1, [], 'green');

    expect(agent.isWaitingAtCrosswalk).toBe(true);
    expect(agent.speed).toBe(0);

    // Quando o semáforo fica vermelho para veículos (verde para pedestres)
    agent.update(0.1, [], 'red');
    expect(agent.isWaitingAtCrosswalk).toBe(false);
  });

  it('deve limpar elementos DOM do label e speechBubble ao chamar dispose()', () => {
    agent.say('Olá mundo');
    expect(document.body.contains(agent.label)).toBe(true);
    expect(document.body.contains(agent.speechBubble!)).toBe(true);

    agent.dispose();
    expect(document.body.contains(agent.label)).toBe(false);
    expect(document.body.contains(agent.speechBubble!)).toBe(false);
  });
});
