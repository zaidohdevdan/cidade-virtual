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

/**
 * Gateway WebSocket para sincronização em tempo real do estado do mundo
 * entre o servidor (apps/api) e o cliente (apps/web-client).
 *
 * Alinhado com SKILL.md v2.0.0 Seção 4 — Comunicação em tempo real: Socket.IO
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

  afterInit(_server: Server): void {
    this.logger.log('WorldGateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Recebe posição atualizada do avatar do cliente.
   */
  @SubscribeMessage('avatar:position')
  handleAvatarPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { x: number; y: number; z: number },
  ): void {
    // Broadcast para os demais clientes conectados
    client.broadcast.emit('avatar:position', {
      clientId: client.id,
      ...data,
    });
  }

  /**
   * Emite estado do mundo para todos os clientes conectados.
   */
  broadcastWorldState(state: Record<string, unknown>): void {
    this.server.emit('world:state', state);
  }

  /**
   * Emite um evento de domínio para todos os clientes.
   */
  broadcastDomainEvent(event: { name: string; payload: unknown }): void {
    this.server.emit('world:event', event);
  }
}
