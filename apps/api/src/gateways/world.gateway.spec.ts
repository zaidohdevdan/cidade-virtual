import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorldGateway } from './world.gateway';
import type { Socket } from 'socket.io';

describe('WorldGateway (Unit Test — Task-003 & Task-021)', () => {
  let gateway: WorldGateway;
  let mockServer: {
    emit: ReturnType<typeof vi.fn>;
  };
  let mockSocket: {
    id: string;
    emit: ReturnType<typeof vi.fn>;
    broadcast: {
      emit: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    gateway = new WorldGateway();
    mockServer = { emit: vi.fn() };
    mockSocket = {
      id: 'socket-123',
      emit: vi.fn(),
      broadcast: {
        emit: vi.fn(),
      },
    };
    gateway.server = mockServer as any;
  });

  afterEach(() => {
    gateway.destroy();
    vi.useRealTimers();
  });

  it('deve inicializar com semáforo autoritativo e enviar estado inicial na conexão do cliente', () => {
    gateway.afterInit(mockServer as any);
    expect(gateway.getTrafficLightState()).toBe('green');

    gateway.handleConnection(mockSocket as unknown as Socket);

    expect(mockSocket.emit).toHaveBeenCalledWith('world:event', {
      name: 'traffic_light.changed',
      payload: { state: 'green' },
    });
  });

  it('deve alternar o ciclo semafórico autoritativamente (8s verde -> 3s amarelo -> 8s vermelho)', () => {
    gateway.afterInit(mockServer as any);
    expect(gateway.getTrafficLightState()).toBe('green');

    // Avança 8s (verde -> amarelo)
    vi.advanceTimersByTime(8000);
    expect(gateway.getTrafficLightState()).toBe('yellow');
    expect(mockServer.emit).toHaveBeenCalledWith('world:event', {
      name: 'traffic_light.changed',
      payload: { state: 'yellow' },
    });

    // Avança 3s (amarelo -> vermelho)
    vi.advanceTimersByTime(3000);
    expect(gateway.getTrafficLightState()).toBe('red');
    expect(mockServer.emit).toHaveBeenCalledWith('world:event', {
      name: 'traffic_light.changed',
      payload: { state: 'red' },
    });

    // Avança 8s (vermelho -> verde)
    vi.advanceTimersByTime(8000);
    expect(gateway.getTrafficLightState()).toBe('green');
  });

  it('deve permitir que God Mode altere o semáforo e faça broadcast para todos', () => {
    gateway.handleSetTrafficLight(mockSocket as unknown as Socket, { state: 'red' });

    expect(gateway.getTrafficLightState()).toBe('red');
    expect(mockServer.emit).toHaveBeenCalledWith('world:event', {
      name: 'traffic_light.changed',
      payload: { state: 'red' },
    });
  });

  it('deve emitir snapshot em world:state incluindo o semáforo autoritativo atual', () => {
    gateway.broadcastWorldState({
      scenarioId: 'rua-central-main',
      weather: 'rain',
      timeOfDay: 18,
      tickCount: 100,
    });

    expect(mockServer.emit).toHaveBeenCalledWith(
      'world:state',
      expect.objectContaining({
        scenarioId: 'rua-central-main',
        weather: 'rain',
        timeOfDay: 18,
        tickCount: 100,
        trafficLight: 'green',
      })
    );
  });
});
