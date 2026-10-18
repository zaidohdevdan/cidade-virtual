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
} from '@cidade-virtual/types';

/**
 * Gateway WebSocket para sincronização em tempo real do estado autoritativo do mundo
 * entre o servidor (apps/api) e todos os clientes conectados (apps/web-client).
 *
 * Alinhado com SKILL.md v2.0.0 Seção 4 e Task-003 / Task-021 do Backlog.
 */
@WebSocketGateway({
  cors: { origin: '*' },
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

  afterInit(_server: Server): void {
    this.logger.log('WorldGateway inicializado no namespace /world');
    this.startAuthoritativeTrafficLightCycle();
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Cliente conectado no /world: ${client.id}`);

    // Envia imediatamente o estado autoritativo atual para o cliente recém-conectado
    client.emit('world:event', {
      name: 'traffic_light.changed',
      payload: { state: this.currentTrafficLight },
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente desconectado do /world: ${client.id}`);
  }

  /**
   * Ciclo Semafórico Autoritativo Server-Side (Padrão DENATRAN em 2 Fases)
   * 8s Verde -> 3s Amarelo -> 8s Vermelho -> repete
   * Garante que todos os clientes compartilham o mesmo relógio universal.
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
   * Recebe posição atualizada do avatar do cliente e faz broadcast.
   */
  @SubscribeMessage('avatar:position')
  handleAvatarPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Omit<AvatarPositionPayload, 'clientId'>,
  ): void {
    client.broadcast.emit('avatar:position', {
      ...data,
      clientId: client.id,
    });
  }

  /**
   * Permite que comandos administrativos (God Mode) alterem o semáforo autoritativamente.
   */
  @SubscribeMessage('traffic_light:set')
  handleSetTrafficLight(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { state: TrafficLightSignal },
  ): void {
    if (data?.state && ['green', 'yellow', 'red'].includes(data.state)) {
      this.currentTrafficLight = data.state;
      this.logger.log(`[GodMode] Semáforo alterado manualmente por ${client.id} para ${data.state}`);

      this.broadcastDomainEvent({
        name: 'traffic_light.changed',
        payload: { state: data.state },
      });
    }
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
  }
}
