import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { AgentAvatar, CITY_AGENTS } from './agent-avatar';
import { speechSynth } from '../audio/speech-synth';

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

  it('deve emitir balão de fala estilizado através do método say() quando próximo (Task-026)', () => {
    agent.isNearPlayer = true;
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
    expect(agent.hasReceivedServerTarget).toBe(true);
    expect(agent.speed).toBe(0);

    // No update subsequente com targetPosition nulo, deve permanecer repousando no local sem voltar a patrulhar
    const xBefore = agent.position.x;
    const zBefore = agent.position.z;
    agent.update(0.1, [], 'green');
    expect(agent.position.x).toBe(xBefore);
    expect(agent.position.z).toBe(zBefore);
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
    agent.say('Olá mundo', 4.0, true);
    expect(document.body.contains(agent.label)).toBe(true);
    expect(document.body.contains(agent.speechBubble!)).toBe(true);

    agent.dispose();
    expect(document.body.contains(agent.label)).toBe(false);
    expect(document.body.contains(agent.speechBubble!)).toBe(false);
  });

  it('os balões de conversações só devem ser emitidos quando o avatar se aproxima do agente', () => {
    const speakSpy = vi.spyOn(speechSynth, 'speak').mockResolvedValue(true);

    // 1. Agente longe do jogador e forceShow falso -> NÃO emite balão e NÃO dispara áudio
    agent.isNearPlayer = false;
    agent.say('Pensamento distante...');
    expect(agent.speechBubble).toBeUndefined();
    expect(speakSpy).not.toHaveBeenCalled();

    // 2. Agente próximo do jogador (isNearPlayer = true) -> Emite balão estilizado E dispara áudio
    agent.isNearPlayer = true;
    agent.say('Olá Daniel, bem-vindo!');
    expect(agent.speechBubble).toBeDefined();
    expect(agent.speechBubble?.innerHTML).toContain('Olá Daniel, bem-vindo!');
    expect(document.body.contains(agent.speechBubble!)).toBe(true);
    expect(speakSpy).toHaveBeenCalledWith('agent-vega', 'Olá Daniel, bem-vindo!');

    speakSpy.mockClear();

    // 3. forceShow = true explícito (ex: diálogo interativo face a face) -> Emite balão e áudio mesmo se isNearPlayer for falso
    agent.isNearPlayer = false;
    agent.say('Resposta no chat', 5, true);
    expect(agent.speechBubble?.innerHTML).toContain('Resposta no chat');
    expect(speakSpy).toHaveBeenCalledWith('agent-vega', 'Resposta no chat');

    speakSpy.mockRestore();
  });

  it('ao afastar o avatar do jogador (> 3.5m), o balão de fala ativo deve ser fechado e o áudio cancelado', () => {
    const stopSpy = vi.spyOn(speechSynth, 'stop').mockImplementation(() => {});

    // Inicia fala em proximidade
    agent.position.set(0, 0, 0);
    const closePlayerPos = new THREE.Vector3(1, 0, 1); // Distância ~1.41m (<= 3.5m)
    agent.update(0.1, [], 'green', closePlayerPos);
    expect(agent.isNearPlayer).toBe(true);

    agent.say('Conversa ativa na calçada');
    expect(agent.speechTimer).toBeGreaterThan(0);

    // Jogador se afasta para além de 3.5m
    const farPlayerPos = new THREE.Vector3(15, 0, 15); // Distância > 20m
    agent.update(0.1, [], 'green', farPlayerPos);

    expect(agent.isNearPlayer).toBe(false);
    expect(agent.speechTimer).toBe(0);
    expect(agent.speechBubble?.style.display).toBe('none');
    expect(stopSpy).toHaveBeenCalled();

    stopSpy.mockRestore();
  });

  it('updateLabel não deve exibir speechBubble se o jogador não estiver próximo', () => {
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = {
      domElement: { clientWidth: 1920, clientHeight: 1080 },
    } as THREE.WebGLRenderer;

    agent.isNearPlayer = false;
    agent.speechTimer = 3.0; // Mesmo se timer tiver valor residual
    if (!agent.speechBubble) {
      agent.speechBubble = document.createElement('div');
    }

    agent.updateLabel(mockCamera, mockRenderer);
    expect(agent.speechBubble.style.display).toBe('none');
  });
});
