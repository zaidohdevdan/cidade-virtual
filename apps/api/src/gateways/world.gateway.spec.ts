// apps/api/src/gateways/world.gateway.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorldGateway } from './world.gateway';
import type { Socket } from 'socket.io';

describe('WorldGateway (Unit Test — Task-003, Task-021 & Task-022)', () => {
  let gateway: WorldGateway;
  let mockServer: {
    emit: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
  };
  let mockSocket: {
    id: string;
    data: { user?: { userId: string; role: 'admin' | 'guest' | 'citizen' } };
    emit: ReturnType<typeof vi.fn>;
    broadcast: {
      emit: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    gateway = new WorldGateway();
    mockServer = {
      emit: vi.fn(),
      use: vi.fn(),
    };
    mockSocket = {
      id: 'socket-123',
      data: { user: { userId: 'admin-root', role: 'admin' } },
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
    expect(mockServer.use).toHaveBeenCalled();

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

  it('deve permitir que God Mode altere o semáforo quando executado por admin', () => {
    gateway.handleSetTrafficLight(mockSocket as unknown as Socket, { state: 'red' });

    expect(gateway.getTrafficLightState()).toBe('red');
    expect(mockServer.emit).toHaveBeenCalledWith('world:event', {
      name: 'traffic_light.changed',
      payload: { state: 'red' },
    });
  });

  it('deve bloquear God Mode quando executado por usuário não-admin', () => {
    const guestSocket = {
      ...mockSocket,
      data: { user: { userId: 'guest-1', role: 'guest' as const } },
      emit: vi.fn(),
    };

    gateway.handleSetTrafficLight(guestSocket as unknown as Socket, { state: 'red' });

    expect(gateway.getTrafficLightState()).toBe('green'); // permanece inalterado
    expect(guestSocket.emit).toHaveBeenCalledWith('error', {
      code: 'FORBIDDEN',
      message: expect.stringContaining('privilégios de administrador'),
    });
  });

  it('deve validar fisicamente avatar:position e rejeitar colisão com edifício', () => {
    // Tenta mover avatar para dentro do Edifício Noroeste (-28, 28)
    gateway.handleAvatarPosition(mockSocket as unknown as Socket, {
      x: -28,
      y: 0,
      z: 28,
    });

    // Não deve fazer broadcast de posição forjada em colisão
    expect(mockSocket.broadcast.emit).not.toHaveBeenCalled();
  });

  it('deve aceitar e fazer broadcast de posição válida desobstruída', () => {
    // Posição válida na pista da Av. Central
    gateway.handleAvatarPosition(mockSocket as unknown as Socket, {
      x: 0,
      y: 0,
      z: 5,
    });

    expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('avatar:position', {
      x: 0,
      y: 0,
      z: 5,
      clientId: 'socket-123',
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
      }),
    );
  });
});
