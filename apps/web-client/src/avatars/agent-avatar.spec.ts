import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { AgentAvatar, CITY_AGENTS } from './agent-avatar';
import { speechSynth } from '../audio/speech-synth';
import { ObstacleCollider } from '../scenes/city-scene';
import { VehicleHornEvent } from '../vehicles/vehicle-agent';

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

  it('deve possuir exatamente os 3 cidadãos estelares ativos (Vega, Sulafat e Sheliak)', () => {
    expect(CITY_AGENTS).toHaveLength(3);

    const names = CITY_AGENTS.map((a) => a.name);
    expect(names).toEqual(['Vega', 'Sulafat', 'Sheliak']);
  });

  it('alertas de bloqueio, fuga e memória de obstáculo NÃO devem emitir áudio de voz pelo speechSynth', () => {
    const speakSpy = vi.spyOn(speechSynth, 'speak').mockResolvedValue(true);
    agent.isNearPlayer = true;

    // Mensagens de bloqueio / fuga devem mostrar balão, mas áudio deve ser silenciado
    agent.say('Detectei um bloqueio recorrente! Calculando saída...');
    expect(agent.speechBubble).toBeDefined();
    expect(agent.speechBubble?.innerHTML).toContain('bloqueio');
    expect(speakSpy).not.toHaveBeenCalled();

    agent.say('Encontrei uma saída segura! Indo para local livre.');
    expect(speakSpy).not.toHaveBeenCalled();

    // Mensagem comum sem bloqueio deve acionar áudio normalmente
    agent.say('Olá Daniel, como vai você?');
    expect(speakSpy).toHaveBeenCalledWith('agent-vega', 'Olá Daniel, como vai você?');

    speakSpy.mockRestore();
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

  it('não deve anexar balões estáticos de nomes de NPCs ao DOM e deve limpar speechBubble ao chamar dispose()', () => {
    agent.say('Olá mundo', 4.0, true);
    // Balão de nome do NPC não deve estar no DOM para evitar poluição visual
    expect(document.body.contains(agent.label)).toBe(false);
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

  it('deve desviar proativamente de obstáculos (muro/caixa) à frente usando sensores em leque', () => {
    // Agente na calçada em (10, 0.19, 10), querendo caminhar no eixo Z para (10, 0.19, 20)
    agent.position.set(10, 0.19, 10);
    agent.setTargetPosition({ x: 10, y: 0.19, z: 20 });

    // Obstáculo diretamente no caminho: bloco entre x=[9, 11] e z=[11, 13]
    const colliders: ObstacleCollider[] = [
      {
        type: 'box',
        minX: 9.0,
        maxX: 11.0,
        minZ: 11.0,
        maxZ: 13.0,
        name: 'test-building',
      },
    ];

    const dirForward = new THREE.Vector3(0, 0, 1);
    const steer = agent.computeAvoidanceSteering(dirForward, colliders);

    // O vetor de steering deve desviar lateralmente (steer.x != 0), contornando o obstáculo
    expect(Math.abs(steer.x)).toBeGreaterThan(0.2);

    // Executa múltiplos passos de update e valida que o agente se move sem penetrar no colisor
    for (let step = 0; step < 15; step++) {
      agent.update(0.1, colliders, 'red');
      // Garante que o agente nunca penetrou o interior do obstáculo
      const isInsideObstacle =
        agent.position.x > 9.0 - agent.radius &&
        agent.position.x < 11.0 + agent.radius &&
        agent.position.z > 11.0 - agent.radius &&
        agent.position.z < 13.0 + agent.radius;
      expect(isInsideObstacle).toBe(false);
    }
  });

  it('quando um carro buzina à frente, o NPC deve entrar em evasão, sair da frente e buscar local livre aleatório', () => {
    // Agente no meio da pista da Avenida Central em (0, 0.19, 15)
    agent.position.set(0, 0.19, 15);
    expect(agent.isRoadAsphalt(agent.position.x, agent.position.z)).toBe(true);

    // Carro em (0, 0.19, 5) trafegando para o Sul (+Z), buzinando
    const hornEvent: VehicleHornEvent = {
      position: new THREE.Vector3(0, 0.19, 5),
      direction: new THREE.Vector3(0, 0, 1),
      sourceVehicleId: 'veh-car-1',
      range: 24.0,
      timestamp: Date.now(),
    };

    // Agente recebe a buzina
    agent.handleVehicleHorn(hornEvent);

    expect(agent.isEvadingVehicle).toBe(true);
    expect(agent.evasionTarget).not.toBeNull();
    // O destino livre escolhido deve estar FORA da pista veicular (calçada/praça livre)
    expect(agent.isRoadAsphalt(agent.evasionTarget!.x, agent.evasionTarget!.z)).toBe(false);
    // Agente emite balão de alerta
    expect(agent.speechBubble).toBeDefined();
    expect(agent.speechBubble?.innerHTML).toMatch(/saindo|veículo|calçada|pista|buzina|livre/i);

    // Simula corrida de evasão até o local seguro
    for (let i = 0; i < 60 && agent.isEvadingVehicle; i++) {
      agent.update(0.1, [], 'green');
    }

    // Após completar a evasão ou aproximar-se do local livre, o agente desobstruiu a pista
    expect(agent.isRoadAsphalt(agent.position.x, agent.position.z)).toBe(false);
  });

  it('deve diagnosticar aprisionamento (deadlock) quando o movimento é obstruído por obstáculos e ativar fuga autônoma', () => {
    // Posiciona o NPC em um beco estreito bloqueado em frente e nas laterais
    agent.position.set(20.0, 0.19, 20.0);
    agent.setTargetPosition({ x: 20.0, y: 0.19, z: 25.0 }); // Quer ir para o norte (+Z)

    // Bloqueia com obstáculos: parede frontal em z=[20.5, 23.0] e laterais em x=[19.0, 19.5] e [20.5, 21.0]
    const colliders: ObstacleCollider[] = [
      { type: 'box', minX: 18.0, maxX: 22.0, minZ: 20.5, maxZ: 22.5, name: 'front-wall' },
      { type: 'box', minX: 19.0, maxX: 19.5, minZ: 19.0, maxZ: 20.5, name: 'left-wall' },
      { type: 'box', minX: 20.5, maxX: 21.0, minZ: 19.0, maxZ: 20.5, name: 'right-wall' },
    ];

    // Simula múltiplos updates com o agente tentando andar mas sem conseguir se deslocar
    let wasEscaping = false;
    for (let i = 0; i < 25; i++) {
      agent.update(0.1, colliders, 'green');
      if (agent.isEscapingDeadlock) {
        wasEscaping = true;
      }
    }

    // O agente deve ter acumulado detecção de travamento e ativado o protocolo de fuga autônoma
    expect(wasEscaping).toBe(true);
    // Deve ter registrado na memória espacial do NPC
    expect(agent.stuckMemories.length).toBeGreaterThan(0);
    // O destino de fuga memorizado não deve colidir com nenhuma parede
    const learnedEscape = agent.stuckMemories[0].escapeWaypoint;
    expect(agent.checkCollision(learnedEscape.x, learnedEscape.z, colliders)).toBe(false);
    // Deve ter emitido balão de fala expressando a descoberta da saída e memorização
    expect(agent.speechBubble).toBeDefined();
    expect(agent.speechBubble?.innerHTML).toMatch(/saída|bloqueio|memori|obstáculo|travad|livre|desobstru/i);
  });

  it('findEscapeRoute deve calcular com inteligência geométrica uma rota de saída desimpedida para área livre fora de becos', () => {
    // Agente em um beco em U fechado no Norte, Leste e Oeste, com saída apenas para o Sul (-Z)
    agent.position.set(30.0, 0.19, 30.0);
    const colliders: ObstacleCollider[] = [
      // Parede Norte (frente)
      { type: 'box', minX: 28.0, maxX: 32.0, minZ: 30.6, maxZ: 35.0, name: 'north-wall' },
      // Parede Oeste (esquerda)
      { type: 'box', minX: 27.0, maxX: 29.5, minZ: 27.0, maxZ: 33.0, name: 'west-wall' },
      // Parede Leste (direita)
      { type: 'box', minX: 30.5, maxX: 33.0, minZ: 27.0, maxZ: 33.0, name: 'east-wall' },
    ];

    const escapeSpot = agent.findEscapeRoute(colliders);
    expect(escapeSpot).not.toBeNull();

    // A rota deve sair pelo lado Sul (z < 30.0)
    expect(escapeSpot!.z).toBeLessThan(30.0);
    // Não deve colidir com nenhum obstáculo
    expect(agent.checkCollision(escapeSpot!.x, escapeSpot!.z, colliders)).toBe(false);
    // Não deve recair sobre asfalto veicular
    expect(agent.isRoadAsphalt(escapeSpot!.x, escapeSpot!.z)).toBe(false);
  });

  it('deve registrar e aprender memórias espaciais com raio de influência, ocorrências e ponto de fuga ao se deparar com armadilhas', () => {
    agent.position.set(40.0, 0.19, 40.0);
    const escapeTarget = new THREE.Vector3(40.0, 0.19, 34.0);

    // 1. Registra memória pela primeira vez
    const mem1 = agent.learnStuckMemory(agent.position, escapeTarget, 'Beco em obra');
    const initialRadius = mem1.radius;
    expect(mem1.occurrences).toBe(1);
    expect(mem1.position.x).toBe(40.0);
    expect(mem1.position.z).toBe(40.0);
    expect(mem1.escapeWaypoint.x).toBe(40.0);
    expect(mem1.escapeWaypoint.z).toBe(34.0);
    expect(agent.stuckMemories).toHaveLength(1);
    expect(agent.hasMemoryNear(40.0, 40.0)).toBe(true);

    // 2. Se o agente re-encontrar travamento na mesma zona (< 3.2m), incrementa ocorrência e expande raio
    const newEscape = new THREE.Vector3(42.0, 0.19, 33.0);
    const mem2 = agent.learnStuckMemory(new THREE.Vector3(40.5, 0.19, 40.2), newEscape);
    expect(mem2.id).toBe(mem1.id);
    expect(mem2.occurrences).toBe(2);
    expect(mem2.radius).toBeGreaterThan(initialRadius);
    expect(agent.stuckMemories).toHaveLength(1);
  });

  it('em navegações futuras, a memória espacial aprendida deve repelir ativamente o NPC para longe da armadilha e guiá-lo para a rota segura', () => {
    // Registra uma armadilha em (15.0, 15.0) com saída segura em (15.0, 8.0)
    agent.stuckMemories = [
      {
        id: 'mem-trap-1',
        position: { x: 15.0, z: 15.0 },
        radius: 3.5,
        escapeWaypoint: { x: 15.0, z: 8.0 },
        timestamp: Date.now(),
        description: 'Obstáculo intransponível',
        occurrences: 2,
      },
    ];

    // Posiciona o NPC se aproximando da armadilha (em 15.0, 12.5), querendo andar em direção a ela (+Z)
    agent.position.set(15.0, 0.19, 12.5);
    const dirTowardsTrap = new THREE.Vector3(0, 0, 1);

    const steer = agent.computeAvoidanceSteering(dirTowardsTrap, []);

    // A direção resultante NÃO deve prosseguir direto para dentro da armadilha (+Z puro)
    // O campo repulsivo da memória deve empurrá-lo para longe do centro (z < 1) e orientá-lo em direção à saída segura
    expect(steer.z).toBeLessThan(0.7);
  });

  it('ao chegar no destino de fuga, o NPC deve permanecer no local livre seguro e expressar alívio no balão de fala', () => {
    agent.position.set(10.0, 0.19, 10.0);
    const freeSpot = new THREE.Vector3(10.0, 0.19, 13.0);

    agent.isEscapingDeadlock = true;
    agent.escapeTarget = freeSpot;
    agent.escapeTimer = 10.0;
    agent.speed = 3.0;

    // Simula deslocamento até o ponto livre
    agent.position.set(10.0, 0.19, 12.8); // dist < 0.9m do freeSpot
    agent.update(0.1, [], 'green');

    // Ao alcançar o local livre, a fuga termina e o NPC descansa em segurança no local livre
    expect(agent.isEscapingDeadlock).toBe(false);
    expect(agent.escapeTarget).toBeNull();
    expect(agent.speed).toBe(0);
    // Expressa alívio e confirmação de local livre
    expect(agent.speechBubble?.innerHTML).toMatch(/local livre|saída/i);
  });

  describe('Aprendizado e Execução de Instruções do Avatar Daniel (Cliente 3D)', () => {
    it('o NPC deve ouvir e gravar a instrução "vc deve evitar o café", definir rota de escape e repelir o café', () => {
      agent.learnInstruction('vc deve evitar o café');
      expect(agent.learnedDirectives).toHaveLength(1);
      expect(agent.learnedDirectives[0].directiveType).toBe('avoid_place');
      expect(agent.learnedDirectives[0].targetCategory).toBe('cafe');

      // Coordenadas dentro da zona do café (x: 25, z: -20) devem ser reconhecidas como evitadas
      expect(agent.isTargetInAvoidedZone(25, -20, 'cafe')).toBe(true);
      expect(agent.isPositionInAvoidedDirective(25, -20)).toBe(true);

      // Deve ter ativado execução de diretiva e navegação imediata para fora da zona do café
      expect(agent.activeDirectiveExecution).not.toBeNull();
      expect(agent.activeDirectiveExecution?.type).toBe('avoid_place');
      expect(agent.targetPosition?.x).toBe(-22.0);
      expect(agent.targetPosition?.z).toBe(18.0);
      expect(agent.speechBubble?.innerHTML).toMatch(/evitando.*café/i);

      // Posiciona o NPC perto do café querendo andar em direção a ele (+X)
      agent.position.set(14, 0.19, -20);
      const dirTowardsCafe = new THREE.Vector3(1, 0, 0);
      const steer = agent.computeAvoidanceSteering(dirTowardsCafe, []);

      // A direção resultante deve ter componente repulsivo para longe do café (x < 1)
      expect(steer.x).toBeLessThan(0.7);
    });

    it('o NPC não deve congelar diante de Daniel (distToPlayer <= 2.2) se tiver uma diretiva ativa em andamento', () => {
      agent.position.set(0, 0.19, 0);
      agent.learnInstruction('vc deve evitar o café');
      expect(agent.activeDirectiveExecution).not.toBeNull();

      // Daniel está a 1.5m de distância (anteriormente causava freeze imediato return;)
      const playerPos = new THREE.Vector3(0, 0.19, 1.5);
      const initialPos = agent.position.clone();

      agent.update(0.1, [], 'green', playerPos);

      // O agente deve ter se movido e não congelado no local
      expect(agent.position.distanceTo(initialPos)).toBeGreaterThan(0);
      expect(agent.speed).toBeGreaterThan(0);
    });

    it('o NPC deve ouvir a instrução "vc deve atravessar a faixa" e direcionar para o meio-fio seguro da faixa de pedestre', () => {
      agent.position.set(10, 0.19, 15);
      agent.learnInstruction('vc deve usar a faixa de pedestre');

      expect(agent.learnedDirectives.some((d) => d.directiveType === 'use_crosswalk')).toBe(true);
      expect(agent.targetPosition).not.toBeNull();
      expect(agent.activeDirectiveExecution?.type).toBe('use_crosswalk');
      // Destino no meio-fio leste da Faixa Sul (z: 9.0, x: 7.5)
      expect(agent.targetPosition?.x).toBe(7.5);
      expect(agent.targetPosition?.z).toBe(9.0);
      expect(agent.activeDirectiveExecution?.finalDestination?.x).toBe(-7.5);
    });

    it('o NPC deve ouvir "vá para o mercado" e rotacionar/navegar imediatamente para o mercado central', () => {
      agent.position.set(-15, 0.19, 0);
      agent.learnInstruction('vá para o mercado');

      expect(agent.activeDirectiveExecution?.type).toBe('go_to_place');
      expect(agent.targetPosition?.x).toBe(0);
      expect(agent.targetPosition?.z).toBe(-36.0);
      expect(agent.speechBubble?.innerHTML).toMatch(/mercado/i);
    });

    it('o NPC deve ouvir "pare aí" e interromper o movimento imediatamente', () => {
      agent.speed = 2.0;
      agent.learnInstruction('pare agora');

      expect(agent.activeDirectiveExecution).toBeNull();
      expect(agent.targetPosition).toBeNull();
      expect(agent.speed).toBe(0);
      expect(agent.waitTimer).toBeGreaterThan(0);
      expect(agent.speechBubble?.innerHTML).toMatch(/parando/i);
    });
  });
});


