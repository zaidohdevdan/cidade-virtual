// tests/integration/security.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signJwtToken,
  verifyJwtToken,
  getJwtSecret,
  _resetEphemeralSecretForTesting,
} from '../../apps/api/src/auth/jwt.util';
import {
  validateAvatarMovement,
  checkPointCollision,
  CITY_BOUNDS,
  OPERATIONAL_LIMITS,
} from '@cidade-virtual/config';
import { WorldGateway } from '../../apps/api/src/gateways/world.gateway';
import type { Socket } from 'socket.io';
import type { AuthPrincipal } from '../../apps/api/src/auth/auth.types';

describe('Task-022 — Endurecimento de Segurança e Validações Autoritativas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetEphemeralSecretForTesting();
  });

  describe('1. Autenticação JWT e Gestão Segura de Segredos', () => {
    it('deve gerar secret efêmero via CSPRNG de 256 bits quando JWT_SECRET não estiver definido', () => {
      delete process.env['JWT_SECRET'];
      _resetEphemeralSecretForTesting();

      const secret = getJwtSecret();
      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBe(64); // 32 bytes hex = 64 chars
    });

    it('deve emitir e validar token JWT assinado com algoritmo HS256 e expiração', () => {
      const principal: AuthPrincipal = {
        userId: 'citizen-security-test',
        role: 'citizen',
        scenarioId: 'rua-central-main',
      };

      const token = signJwtToken(principal, '1h');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = verifyJwtToken(token);
      expect(verified.userId).toBe('citizen-security-test');
      expect(verified.role).toBe('citizen');
      expect(verified.scenarioId).toBe('rua-central-main');
    });

    it('deve rejeitar token com assinatura adulterada ou secret divergente', () => {
      const principal: AuthPrincipal = {
        userId: 'malicious-attacker',
        role: 'admin',
      };

      const token = signJwtToken(principal, '1h');
      const tamperedToken = token.slice(0, -6) + 'abcdef';

      expect(() => verifyJwtToken(tamperedToken)).toThrow();
    });

    it('deve rejeitar token expirado (exp claim)', () => {
      const principal: AuthPrincipal = {
        userId: 'expired-session',
        role: 'guest',
      };

      // Cria token com 1 segundo de validade
      const token = signJwtToken(principal, 1 as any);

      // Avança o tempo em 5 segundos
      vi.advanceTimersByTime(5000);

      expect(() => verifyJwtToken(token)).toThrow();
    });
  });

  describe('2. Validação Física Server-Side de Movimentos e Colisões', () => {
    it('deve rejeitar posições fora dos limites territoriais da cidade', () => {
      const outOfBoundsPoint = { x: 100, y: 0, z: 100 };
      const res = validateAvatarMovement(undefined, outOfBoundsPoint);

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('OUT_OF_BOUNDS');
    });

    it('deve detectar colisão com edifícios urbanos e rejeitar destino dentro de parede', () => {
      // Edifício Noroeste está localizado em [-40.3, -15.7] x [15.7, 40.3]
      const insideBuildingPoint = { x: -28, y: 0, z: 28 };
      const col = checkPointCollision(insideBuildingPoint.x, insideBuildingPoint.z);

      expect(col.collides).toBe(true);
      expect(col.collider?.name).toBe('Edifício Noroeste');

      const res = validateAvatarMovement(undefined, insideBuildingPoint);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('COLLISION_DETECTED');
      expect(res.colliderName).toBe('Edifício Noroeste');
    });

    it('deve detectar colisão com a Fonte Monumental da Praça Central', () => {
      // Fonte no centro da praça (25, 25) com raio 2.75m
      const fountainCenter = { x: 25.0, y: 0, z: 25.0 };
      const res = validateAvatarMovement(undefined, fountainCenter);

      expect(res.valid).toBe(false);
      expect(res.reason).toContain('COLLISION_DETECTED');
      expect(res.colliderName).toBe('Fonte Monumental da Praça');
    });

    it('deve rejeitar travessia direta através de obstáculo (Wall Phasing / Clipping proibido)', () => {
      // Ponto de partida: interior da praça central (z = 36.5)
      // Ponto de chegada forjado: calçada sul além da mureta (z = 39.5)
      // A trajetória em linha reta atravessa a 'Mureta Sul da Praça' (z entre 37.6 e 38.4)
      const prev = { x: 25.0, y: 0, z: 36.5, timestamp: 1000 };
      const next = { x: 25.0, y: 0, z: 39.5 };

      const res = validateAvatarMovement(prev, next, 1000 + 1000); // 1 segundo depois (3 m/s)
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('WALL_PHASING_REJECTED');
      expect(res.colliderName).toBe('Mureta Sul da Praça');
    });

    it('deve rejeitar deslocamento instantâneo excessivo (salto > 20 metros)', () => {
      const prev = { x: 0, y: 0, z: 0, timestamp: 1000 };
      const next = { x: 0, y: 0, z: 35 }; // 35 metros de salto

      const res = validateAvatarMovement(prev, next, 1050);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('TELEPORT_REJECTED');
    });

    it('deve rejeitar velocidade anômala acima de OPERATIONAL_LIMITS.maxAvatarSpeedMps (15 m/s)', () => {
      const prev = { x: 0, y: 0, z: 0, timestamp: 1000 };
      // Moveu 10 metros em 100ms = 100 m/s (muito superior a 15 m/s)
      const next = { x: 0, y: 0, z: 10 };

      const res = validateAvatarMovement(prev, next, 1100);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('MAX_SPEED_EXCEEDED');
    });

    it('deve aceitar movimentação legítima na via urbana desobstruída dentro do limite de velocidade', () => {
      const prev = { x: 0, y: 0, z: 0, timestamp: 1000 };
      // Moveu 2 metros em 500ms = 4 m/s (caminhada/corrida permitida)
      const next = { x: 0, y: 0, z: 2 };

      const res = validateAvatarMovement(prev, next, 1500);
      expect(res.valid).toBe(true);
    });
  });

  describe('3. Handshake WebSocket Autenticado e Controle de Acesso no WorldGateway', () => {
    let gateway: WorldGateway;
    let mockServer: any;
    let handshakeMiddleware: (socket: any, next: (err?: any) => void) => void;

    beforeEach(() => {
      gateway = new WorldGateway();
      mockServer = {
        emit: vi.fn(),
        use: vi.fn((fn) => {
          handshakeMiddleware = fn;
        }),
      };
      gateway.server = mockServer;
      gateway.afterInit(mockServer);
    });

    afterEach(() => {
      gateway.destroy();
    });

    it('deve rejeitar handshake Socket.IO sem token com erro AUTHENTICATION_FAILED', () => {
      const unauthenticatedSocket = {
        id: 'anon-socket-1',
        handshake: {
          headers: {},
          auth: {},
        },
        data: {},
      };

      const next = vi.fn();
      handshakeMiddleware(unauthenticatedSocket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const errorArg = next.mock.calls[0][0];
      expect(errorArg.message).toContain('AUTHENTICATION_FAILED: Token não fornecido');
    });

    it('deve rejeitar handshake Socket.IO com token inválido', () => {
      const forgedSocket = {
        id: 'forged-socket-1',
        handshake: {
          headers: {},
          auth: { token: 'invalid.forged.jwt.token' },
        },
        data: {},
      };

      const next = vi.fn();
      handshakeMiddleware(forgedSocket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const errorArg = next.mock.calls[0][0];
      expect(errorArg.message).toContain('AUTHENTICATION_FAILED: Token inválido ou expirado');
    });

    it('deve autenticar com sucesso handshake com token JWT válido e anexar o Principal em socket.data', () => {
      const principal: AuthPrincipal = {
        userId: 'citizen-42',
        role: 'citizen',
        scenarioId: 'rua-central-main',
      };
      const validToken = signJwtToken(principal);

      const validSocket = {
        id: 'valid-socket-42',
        handshake: {
          headers: {},
          auth: { token: validToken },
        },
        data: {},
      };

      const next = vi.fn();
      handshakeMiddleware(validSocket, next);

      expect(next).toHaveBeenCalledWith(); // sucesso sem erro
      expect((validSocket.data as any).user).toBeDefined();
      expect((validSocket.data as any).user.userId).toBe('citizen-42');
      expect((validSocket.data as any).user.role).toBe('citizen');
    });

    it('deve rejeitar God Mode de semáforo quando acionado por papel não-admin', () => {
      const guestSocket: any = {
        id: 'guest-socket-99',
        data: { user: { userId: 'guest-user', role: 'guest' } },
        emit: vi.fn(),
      };

      gateway.handleSetTrafficLight(guestSocket, { state: 'red' });

      // O semáforo permanece inalterado
      expect(gateway.getTrafficLightState()).toBe('green');
      expect(guestSocket.emit).toHaveBeenCalledWith('error', {
        code: 'FORBIDDEN',
        message: expect.stringContaining('privilégios de administrador'),
      });
    });

    it('deve autorizar God Mode de semáforo quando acionado por admin', () => {
      const adminSocket: any = {
        id: 'admin-socket-1',
        data: { user: { userId: 'admin-root', role: 'admin' } },
        emit: vi.fn(),
      };

      gateway.handleSetTrafficLight(adminSocket, { state: 'red' });

      expect(gateway.getTrafficLightState()).toBe('red');
      expect(mockServer.emit).toHaveBeenCalledWith('world:event', {
        name: 'traffic_light.changed',
        payload: { state: 'red' },
      });
    });

    it('deve aplicar rate limiting por socket e rejeitar mensagens que excedam OPERATIONAL_LIMITS.maxSocketMessagesPerSecond', () => {
      const clientSocket: any = {
        id: 'rapid-fire-socket',
        data: { user: { userId: 'fast-user', role: 'citizen' } },
        emit: vi.fn(),
        broadcast: { emit: vi.fn() },
      };

      const maxLimit = OPERATIONAL_LIMITS.maxSocketMessagesPerSecond; // 30 msgs/s

      // Envia 30 mensagens legítimas
      for (let i = 0; i < maxLimit; i++) {
        gateway.handleAvatarPosition(clientSocket, { x: 0, y: 0, z: i * 0.1 });
      }

      expect(clientSocket.broadcast.emit).toHaveBeenCalledTimes(maxLimit);

      // A mensagem 31 no mesmo segundo deve disparar o rate limit
      gateway.handleAvatarPosition(clientSocket, { x: 0, y: 0, z: 3.1 });

      expect(clientSocket.emit).toHaveBeenCalledWith('error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('Limite de taxa de mensagens excedido'),
      });
      // Broadcast não deve ser disparado para a 31ª mensagem
      expect(clientSocket.broadcast.emit).toHaveBeenCalledTimes(maxLimit);
    });
  });
});
