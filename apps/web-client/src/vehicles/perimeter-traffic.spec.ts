import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VehicleAgent, CITY_VEHICLES } from './vehicle-agent';

describe('Perimeter Ring Road Traffic (Unit Tests — Web Client)', () => {
  it('frota CITY_VEHICLES deve conter 8 veículos incluindo os 4 dedicados ao Anel Viário', () => {
    expect(CITY_VEHICLES).toHaveLength(8);

    const perimeterVehicles = CITY_VEHICLES.filter((v) => v.routeCircuit !== undefined);
    expect(perimeterVehicles).toHaveLength(4);

    const bus = perimeterVehicles.find((v) => v.id === 'veh-bus-perimetral');
    expect(bus).toBeDefined();
    expect(bus!.routeCircuit).toBe('PERIMETER_CCW');

    const patrol = perimeterVehicles.find((v) => v.id === 'veh-patrol-perimetral');
    expect(patrol).toBeDefined();
    expect(patrol!.routeCircuit).toBe('PERIMETER_CW');
  });

  it('veículo perimetral CCW deve navegar no anel viário externo (distância 71.5m)', () => {
    const config = CITY_VEHICLES.find((v) => v.id === 'veh-bus-perimetral')!;
    const car = new VehicleAgent(config);

    expect(car.position.z).toBeCloseTo(71.5);
    expect(car.position.x).toBeCloseTo(0);

    // Simula 1 segundo de navegação desimpedida no Ramo Sul (sentido Leste +X)
    for (let step = 0; step < 60; step++) {
      car.update(0.016, [], [], new THREE.Vector3(0, 0, 0), [car]);
    }

    expect(car.position.x).toBeGreaterThan(0);
    expect(car.position.z).toBeCloseTo(71.5, 0.5);
    expect(car.speed).toBeGreaterThan(0);
  });

  it('veículo perimetral CW deve navegar no anel viário interno (distância 64.5m)', () => {
    const config = CITY_VEHICLES.find((v) => v.id === 'veh-patrol-perimetral')!;
    const car = new VehicleAgent(config);

    expect(car.position.z).toBeCloseTo(64.5);
    expect(car.position.x).toBeCloseTo(0);

    // Simula 1 segundo de navegação desimpedida no Ramo Sul (sentido Oeste -X)
    for (let step = 0; step < 60; step++) {
      car.update(0.016, [], [], new THREE.Vector3(0, 0, 0), [car]);
    }

    expect(car.position.x).toBeLessThan(0);
    expect(car.position.z).toBeCloseTo(64.5, 0.5);
    expect(car.speed).toBeGreaterThan(0);
  });

  it('veículo perimetral deve acionar a conversão de canto (TURNING) ao se aproximar de 61.5m', () => {
    const config = CITY_VEHICLES.find((v) => v.id === 'veh-bus-perimetral')!;
    // Inicia a 1m do início da curva do Canto SE
    const nearCornerConfig = {
      ...config,
      startPosition: new THREE.Vector3(61.0, 0.19, 71.5),
    };
    const car = new VehicleAgent(nearCornerConfig);
    car.speed = 6.0;

    // Atualiza alguns frames para cruzar 61.5m
    for (let step = 0; step < 10; step++) {
      car.update(0.016, [], [], new THREE.Vector3(0, 0, 0), [car]);
    }

    expect(car.state).toBe('TURNING');
  });
});
