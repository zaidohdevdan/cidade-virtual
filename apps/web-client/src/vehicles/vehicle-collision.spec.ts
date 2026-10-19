import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VehicleAgent, VehicleConfig } from './vehicle-agent';
import { AgentAvatar, AgentConfig } from '../avatars/agent-avatar';
import { DanielAvatar } from '../avatars/daniel-avatar';

describe('Vehicle & Agent Collision Physics (Unit Tests — Web Client)', () => {
  const createTestCar = (id: string, x: number, z: number, axis: 'NS' | 'EW' = 'NS', dir: 1 | -1 = 1): VehicleAgent => {
    const config: VehicleConfig = {
      id,
      name: `Car-${id}`,
      modelName: 'Sedan Test',
      type: 'sedan',
      color: 0x2196f3,
      cruiseSpeed: 8.0,
      startPosition: new THREE.Vector3(x, 0, z),
      startRotationY: 0,
      routeAxis: axis,
      routeDirection: dir,
    };
    return new VehicleAgent(config);
  };

  it('VehicleAgent deve retornar 3 colisores cilíndricos cobrindo todo o chassi', () => {
    const car = createTestCar('car-1', 0, 0);
    const colliders = car.getColliders();

    expect(colliders).toHaveLength(3);
    for (const c of colliders) {
      expect(c.type).toBe('cylinder');
      expect(c.radius).toBeCloseTo(1.05);
      expect(c.cx).toBeDefined();
      expect(c.cz).toBeDefined();
    }
  });

  it('Veículo deve perceber pedestre à frente e acionar frenagem de emergência (OBSTACLE_BRAKING)', () => {
    // Carro em x = -3.5, z = 0, indo no sentido Sul (+Z)
    const car = createTestCar('car-1', -3.5, 0, 'NS', 1);
    const pedPos = new THREE.Vector3(-3.5, 0, 4.0); // 4m à frente (lon = 4.0 > 2.3)

    car.update(0.016, [], [pedPos], new THREE.Vector3(100, 0, 100), [car]);

    expect(car.state).toBe('OBSTACLE_BRAKING');
    expect(car.speed).toBeLessThan(car.config.cruiseSpeed);
  });

  it('Veículo não deve ignorar obstáculos em contato ou próximos ao centro (lon <= 0.5)', () => {
    // Carro em x = -3.5, z = 0, indo no sentido Sul (+Z)
    const car = createTestCar('car-1', -3.5, 0, 'NS', 1);
    // Pedestre em lon = 0.2 (dentro/sobreposto ao para-choque)
    const pedPos = new THREE.Vector3(-3.5, 0, 0.2);

    car.update(0.016, [], [pedPos], new THREE.Vector3(100, 0, 100), [car]);

    expect(car.state).toBe('OBSTACLE_BRAKING');
    // Deve aplicar desaceleração máxima ou velocidade zero
    expect(car.speed).toBeLessThanOrEqual(car.config.cruiseSpeed * 0.4);
  });

  it('Dois veículos em aproximação devem frear e não se sobrepor', () => {
    // Carro líder em z = 8.0, carro seguidor em z = 0
    const leader = createTestCar('leader', -3.5, 8.0, 'NS', 1);
    const follower = createTestCar('follower', -3.5, 0.0, 'NS', 1);

    leader.speed = 0; // líder parado
    const vehicles = [follower, leader];

    // Simula 2 segundos de aproximação
    for (let step = 0; step < 60; step++) {
      follower.update(0.016, [], [], new THREE.Vector3(100, 0, 100), vehicles);
    }

    expect(follower.state).toBe('OBSTACLE_BRAKING');
    // Para-choque do seguidor não deve ultrapassar o líder (distância mínima entre centros ~ 4.6m)
    const dist = follower.position.distanceTo(leader.position);
    expect(dist).toBeGreaterThanOrEqual(4.0);
  });

  it('Resolução física anti-penetração deve repelir veículos sobrepostos', () => {
    // Dois veículos forçados na mesma coordenada inicial (sobreposição grave)
    const carA = createTestCar('car-A', -3.5, 5.0, 'NS', 1);
    const carB = createTestCar('car-B', -3.5, 5.2, 'NS', 1);
    const vehicles = [carA, carB];

    carA.update(0.016, [], [], new THREE.Vector3(100, 0, 100), vehicles);

    const distAfter = carA.position.distanceTo(carB.position);
    // As posições devem ser separadas fisicamente
    expect(distAfter).toBeGreaterThan(0.2);
    expect(carA.speed).toBe(0);
  });

  it('Resolução física de pedestre deve empurrar avatar para fora da carroceria do carro', () => {
    const car = createTestCar('car-1', 0, 0, 'NS', 1);
    const pedPos = new THREE.Vector3(0.1, 0, 0.1); // Sobreposto ao centro do carro

    car.update(0.016, [], [pedPos], new THREE.Vector3(100, 0, 100), [car]);

    const dist = pedPos.distanceTo(car.position);
    // Deve ser empurrado para além do raio de colisão do carro + pedestre (~1.05 + 0.45 = 1.5m)
    expect(dist).toBeGreaterThanOrEqual(1.45);
    expect(car.state).toBe('OBSTACLE_BRAKING');
  });

  it('DanielAvatar deve colidir com cilindros de colisão de outros agentes e veículos', () => {
    const player = new DanielAvatar();
    player.position.set(0, 0, 0);

    // Obstáculo à frente em z = 0.6 com raio 0.4 (distância 0.6 < player.radius + 0.4 = 0.85)
    const colliders = [
      {
        type: 'cylinder' as const,
        cx: 0,
        cz: 0.6,
        radius: 0.4,
        name: 'Agent-Vega',
      },
    ];

    const input = { forward: true, backward: false, left: false, right: false, sprint: false };
    // Câmera olhando para o Sul (Z positivo)
    player.update(0.05, input, 0, colliders);

    // O jogador não deve ter ultrapassado z = 0.6 (o avatar é bloqueado)
    expect(player.position.z).toBeLessThan(0.6);
  });

  it('evaluateManeuverFreedom deve calcular corretamente folga de ré em via livre vs via bloqueada', () => {
    // Carro A em x=3.5, z=14.0 (Avenida Central, sentido Norte: dir = -1)
    const carA = createTestCar('car-A', 3.5, 14.0, 'NS', -1);
    // Traseira de carA é no sentido +Z (Sul). Sem ninguém atrás, liberdade deve ser ampla (>= 10m)
    const freedomFree = carA.evaluateManeuverFreedom([]);
    expect(freedomFree).toBeGreaterThanOrEqual(10.0);

    // Coloca um Carro B atrás de Carro A (em z = 18.0)
    const carB = createTestCar('car-B', 3.5, 18.0, 'NS', -1);
    const freedomBlocked = carA.evaluateManeuverFreedom([carB]);

    // A liberdade de ré agora deve estar restrita pela presença de carB atrás
    expect(freedomBlocked).toBeLessThan(4.0);
    expect(freedomBlocked).toBeLessThan(freedomFree);
  });

  it('Em situação de engavetamento no cruzamento, o carro mais livre deve assumir DEADLOCK_ESCAPE e dar ré', () => {
    // Cenário:
    // Carro A (Sedan) em x=3.5, z=13.0 (sentido Norte, dir = -1) - Traseira desimpedida
    // Carro B (Hatch) em x=3.5, z=9.5 (sentido Norte, dir = -1) parado com Carro C bloqueando sua frente
    // Carro C em x=3.5, z=5.5 parado perpendicularmente
    const carA = createTestCar('car-A', 3.5, 13.0, 'NS', -1);
    const carB = createTestCar('car-B', 3.5, 9.5, 'NS', -1);
    const carC = createTestCar('car-C', 3.5, 5.5, 'NS', -1);

    // Carro C e B estão bloqueados com velocidade zero
    carB.speed = 0;
    carC.speed = 0;
    const vehicles = [carA, carB, carC];

    // Simula tempo de bloqueio contínuo no cruzamento (> 2.5 segundos)
    for (let i = 0; i < 70; i++) {
      carA.update(0.04, [], [], new THREE.Vector3(100, 0, 100), vehicles);
      carB.update(0.04, [], [], new THREE.Vector3(100, 0, 100), vehicles);
      carC.update(0.04, [], [], new THREE.Vector3(100, 0, 100), vehicles);
    }

    // O Carro A (mais livre, com traseira vazia) deve ter assumido DEADLOCK_ESCAPE
    expect(carA.state).toBe('DEADLOCK_ESCAPE');

    // Ao executar a manobra de desengavetamento, Carro A deve recuar (dar ré para +Z)
    // Coordenada Z inicial era 13.0, após a ré deve ser maior que 13.0 (mais ao sul, abrindo espaço)
    expect(carA.position.z).toBeGreaterThan(13.2);

    // A distância entre o Carro A e o Carro B deve ter aumentado em relação ao contato inicial
    const initialDist = 13.0 - 9.5; // 3.5m
    const currentDist = carA.position.distanceTo(carB.position);
    expect(currentDist).toBeGreaterThan(initialDist);
  });

  it('Em engavetamento com pedestre travando o carro da frente, o carro mais livre de trás deve cooperar e dar ré', () => {
    // Cenário idêntico ao vídeo:
    // Carro Líder (SUV) em x=-3.5, z=5.0 (sentido Sul, dir = 1), bloqueado por um pedestre a 1.2m na frente
    // Carro Seguidor (Coupé) em x=-3.5, z=0.0 (sentido Sul, dir = 1) com a traseira norte totalmente livre
    const pedPos = new THREE.Vector3(-3.5, 0, 6.2); // Pedestre na frente do SUV
    const suv = createTestCar('suv', -3.5, 5.0, 'NS', 1);
    const coupe = createTestCar('coupe', -3.5, 0.0, 'NS', 1);

    const vehicles = [suv, coupe];

    // Simula bloqueio por mais de 2.0s
    for (let i = 0; i < 60; i++) {
      suv.update(0.04, [], [pedPos], new THREE.Vector3(100, 0, 100), vehicles);
      coupe.update(0.04, [], [pedPos], new THREE.Vector3(100, 0, 100), vehicles);
    }

    // O Coupé (carro mais livre da fila) deve ter sido acionado para DEADLOCK_ESCAPE
    expect(coupe.state).toBe('DEADLOCK_ESCAPE');
    // Deve recuar para o Norte (z diminuindo, afastando-se do SUV)
    expect(coupe.position.z).toBeLessThan(0.0);
  });
});
