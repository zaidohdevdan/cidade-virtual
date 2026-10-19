// apps/api/src/gateways/world.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type {
  TrafficLightSignal,
  WorldStateEventPayload,
  AvatarPositionPayload,
  PrincipalRole,
  Principal,
  ActionRequest,
  ActionResult,
} from '@cidade-virtual/types';
import { createPrincipal } from '@cidade-virtual/types';
import {
  OPERATIONAL_LIMITS,
  validateAvatarMovement,
  PositionPoint,
} from '@cidade-virtual/config';
import { verifyJwtToken } from '../auth/jwt.util';

/**
 * Gateway WebSocket para sincronização em tempo real do estado autoritativo do mundo
 * com endurecimento completo de segurança (Task-022 / mandatory-secure-web-skills).
 *
 * - Whitelist estrita de CORS sem wildcard '*'
 * - Handshake autenticado via JWT (rejeição de handshake anônimo / token inválido)
 * - Rate limiting individual de mensagens por socket (OPERATIONAL_LIMITS.maxSocketMessagesPerSecond)
 * - Validação física server-side de posições (rejeita colisões, pulos anômalos e wall phasing com log [SECURITY] [AUDIT])
 * - Controle de acesso por papel (RBAC): God Mode reservado exclusivamente para admins
 */
@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = (
        process.env['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:3000,http://127.0.0.1:3000'
      )
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS_NOT_ALLOWED: Origem não permitida pela whitelist'), false);
      }
    },
    credentials: true,
  },
  namespace: '/world',
})
export class WorldGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WorldGateway.name);

  @WebSocketServer()
  server!: Server;

  // Estado autoritativo em tempo real do semáforo mantido no servidor
  private currentTrafficLight: TrafficLightSignal = 'green';
  private trafficLightTimer: NodeJS.Timeout | null = null;

  // Mapas em memória para segurança e validação física server-side
  private clientMessageCounts = new Map<string, { count: number; windowStart: number }>();
  private lastKnownPositions = new Map<string, PositionPoint>();

  afterInit(server: Server): void {
    this.logger.log('WorldGateway inicializado no namespace /world com controles de segurança ativos');

    // Middleware de Autenticação no Handshake do Socket.IO (Task-022)
    server.use((socket, next) => {
      const authHeader = socket.handshake.headers['authorization'];
      const token =
        socket.handshake.auth?.token ||
        (typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined);

      if (!token) {
        this.logger.warn(`[SECURITY] [AUDIT] Conexão WS rejeitada: Handshake sem token (socket: ${socket.id})`);
        return next(new Error('AUTHENTICATION_FAILED: Token não fornecido'));
      }

      try {
        const user = verifyJwtToken(token);
        socket.data.user = user;
        this.logger.log(
          `[SECURITY] [AUDIT] Handshake WS autenticado com sucesso para: ${user.userId} (role: ${user.role}, socket: ${socket.id})`,
        );
        next();
      } catch (err: any) {
        this.logger.warn(
          `[SECURITY] [AUDIT] Conexão WS rejeitada: Token inválido (${err.message}) (socket: ${socket.id})`,
        );
        return next(new Error('AUTHENTICATION_FAILED: Token inválido ou expirado'));
      }
    });

    this.startAuthoritativeTrafficLightCycle();
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Cliente conectado no /world: ${client.id} (user: ${client.data?.user?.userId ?? 'unknown'})`);

    // Envia imediatamente o estado autoritativo atual para o cliente recém-conectado
    client.emit('world:event', {
      name: 'traffic_light.changed',
      payload: { state: this.currentTrafficLight },
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente desconectado do /world: ${client.id}`);
    this.clientMessageCounts.delete(client.id);
    this.lastKnownPositions.delete(client.id);
  }

  /**
   * Rate limiting por socket derivado de OPERATIONAL_LIMITS.maxSocketMessagesPerSecond
   */
  private checkSocketRateLimit(client: Socket): boolean {
    const now = Date.now();
    const windowMs = 1000;
    const maxPerSec = OPERATIONAL_LIMITS.maxSocketMessagesPerSecond;

    let entry = this.clientMessageCounts.get(client.id);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 1, windowStart: now };
      this.clientMessageCounts.set(client.id, entry);
      return true;
    }

    entry.count++;
    if (entry.count > maxPerSec) {
      this.logger.warn(
        `[SECURITY] [AUDIT] Rate limit de socket excedido para cliente ${client.id} (${entry.count} msgs/s)`,
      );
      client.emit('error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Limite de taxa de mensagens excedido (máximo de ${maxPerSec} msgs/s).`,
      });
      return false;
    }
    return true;
  }

  /**
   * Ciclo Semafórico Autoritativo Server-Side (Padrão DENATRAN em 2 Fases)
   * 8s Verde -> 3s Amarelo -> 8s Vermelho -> repete
   */
  private startAuthoritativeTrafficLightCycle(): void {
    const scheduleNext = (state: TrafficLightSignal) => {
      const delay = state === 'yellow' ? 3000 : 8000;
      const nextState: TrafficLightSignal =
        state === 'green' ? 'yellow' : state === 'yellow' ? 'red' : 'green';

      this.trafficLightTimer = setTimeout(() => {
        this.currentTrafficLight = nextState;
        this.broadcastDomainEvent({
          name: 'traffic_light.changed',
          payload: { state: nextState },
        });
        scheduleNext(nextState);
      }, delay);
    };

    scheduleNext(this.currentTrafficLight);
  }

  /**
   * Recebe posição atualizada do avatar do cliente, valida fisicamente no servidor
   * contra colisores e velocidade, e faz broadcast apenas de movimentos legítimos.
   */
  @SubscribeMessage('avatar:position')
  handleAvatarPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Omit<AvatarPositionPayload, 'clientId'>,
  ): void {
    if (!this.checkSocketRateLimit(client)) {
      return;
    }

    if (
      typeof data?.x !== 'number' ||
      typeof data?.y !== 'number' ||
      typeof data?.z !== 'number' ||
      isNaN(data.x) ||
      isNaN(data.y) ||
      isNaN(data.z)
    ) {
      this.logger.warn(`[SECURITY] [AUDIT] Posição rejeitada por payload numérico inválido de ${client.id}`);
      return;
    }

    const prev = this.lastKnownPositions.get(client.id);
    const now = Date.now();
    const nextPoint: PositionPoint = { x: data.x, y: data.y, z: data.z, timestamp: now };

    const validation = validateAvatarMovement(prev, nextPoint, now);
    if (!validation.valid) {
      this.logger.warn(
        `[SECURITY] [AUDIT] Movimento forjado ou colisão detectada para cliente ${client.id}: ${validation.reason}`,
      );
      if (prev) {
        client.emit('avatar:correction', {
          x: prev.x,
          y: prev.y,
          z: prev.z,
          reason: validation.reason,
        });
      }
      return;
    }

    // Posição válida: atualiza estado do cliente e realiza broadcast
    this.lastKnownPositions.set(client.id, nextPoint);

    client.broadcast.emit('avatar:position', {
      ...data,
      clientId: client.id,
    });
  }

  /**
   * Permite que comandos administrativos (God Mode) alterem o semáforo autoritativamente.
   * RESTRITO EXCLUSIVAMENTE a usuários com papel 'admin'.
   */
  @SubscribeMessage('traffic_light:set')
  handleSetTrafficLight(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { state: TrafficLightSignal },
  ): void {
    const user = client.data?.user;
    if (!user || user.role !== 'admin') {
      this.logger.warn(
        `[SECURITY] [AUDIT] Tentativa de comando administrativo [traffic_light:set] por usuário sem permissão: ${user?.userId ?? client.id}`,
      );
      client.emit('error', {
        code: 'FORBIDDEN',
        message: 'Acesso negado: Requer privilégios de administrador',
      });
      return;
    }

    if (data?.state && ['green', 'yellow', 'red'].includes(data.state)) {
      this.currentTrafficLight = data.state;
      this.logger.log(
        `[SECURITY] [AUDIT] [GodMode] Semáforo alterado autoritativamente por admin ${user.userId} para ${data.state}`,
      );

      this.broadcastDomainEvent({
        name: 'traffic_light.changed',
        payload: { state: data.state },
      });
    }
  }

  private actionsService?: {
    executeAction(request: ActionRequest): Promise<ActionResult>;
  };

  /**
   * Conecta a instância do ActionsService ao gateway de forma desacoplada.
   */
  setActionsService(service: { executeAction(request: ActionRequest): Promise<ActionResult> }): void {
    this.actionsService = service;
  }

  /**
   * Executa uma ação de acordo com o contrato AgentAction API (Task-025) via WebSocket.
   * Converte o cliente autenticado em Principal e despacha para o ActionsService.
   */
  @SubscribeMessage('agent:action')
  async handleAgentAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      actionType: string;
      parameters?: Record<string, unknown>;
      targetId?: string;
      reasonCode?: string;
    },
  ): Promise<ActionResult> {
    if (!this.checkSocketRateLimit(client)) {
      return {
        success: false,
        actionType: data?.actionType ?? 'unknown',
        principalId: client.id,
        reasonCode: 'RATE_LIMIT_EXCEEDED',
        error: 'Limite de mensagens por segundo excedido',
        timestamp: new Date().toISOString(),
      };
    }

    const user = client.data?.user;
    const principalRole: PrincipalRole = (user?.role as PrincipalRole) ?? 'guest';
    const principal = createPrincipal({
      id: user?.userId ?? client.id,
      type: principalRole === 'admin' ? 'human' : 'human',
      roles: [principalRole],
      displayName: user?.userId ?? client.id,
    });

    const request: ActionRequest = {
      principal,
      actionType: data.actionType,
      targetId: data.targetId,
      parameters: data.parameters ?? {},
      reasonCode: data.reasonCode ?? 'SOCKET_ACTION',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    if (this.actionsService) {
      const result = await this.actionsService.executeAction(request);
      client.emit('agent:action:result', result);
      return result;
    }

    return {
      success: true,
      actionType: data.actionType,
      principalId: principal.id,
      outcome: 'Ação despachada via gateway',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retorna o estado atual do semáforo autoritativo.
   */
  getTrafficLightState(): TrafficLightSignal {
    return this.currentTrafficLight;
  }

  /**
   * Emite snapshot do estado do mundo para todos os clientes conectados.
   */
  broadcastWorldState(state: WorldStateEventPayload | Record<string, unknown>): void {
    if (this.server) {
      this.server.emit('world:state', {
        ...state,
        trafficLight: this.currentTrafficLight,
      });
    }
  }

  /**
   * Emite um evento de domínio tipado para todos os clientes.
   */
  broadcastDomainEvent(event: { name: string; payload: unknown }): void {
    if (this.server) {
      this.server.emit('world:event', event);
    }
  }

  destroy(): void {
    if (this.trafficLightTimer) {
      clearTimeout(this.trafficLightTimer);
    }
    this.clientMessageCounts.clear();
    this.lastKnownPositions.clear();
  }
}
