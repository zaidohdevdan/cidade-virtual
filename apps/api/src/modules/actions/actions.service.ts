// apps/api/src/modules/actions/actions.service.ts
import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import type {
  ActionRequest,
  ActionResult,
  TrafficLightSignal,
} from '@cidade-virtual/types';
import { validateAvatarMovement, PositionPoint } from '@cidade-virtual/config';
import { WorldGateway } from '../../gateways/world.gateway';

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);
  private readonly lastKnownPositions = new Map<string, PositionPoint>();

  constructor(@Optional() @Inject(WorldGateway) private readonly worldGateway?: WorldGateway) {
    if (this.worldGateway) {
      this.worldGateway.setActionsService(this);
    }
  }

  /**
   * Executa uma ação de acordo com o contrato unificado AgentAction API (Task-025).
   * Valida autorização do Principal, regras físicas do mundo e persistência/broadcast.
   */
  async executeAction(request: ActionRequest): Promise<ActionResult> {
    const { principal, actionType, parameters, targetId, reasonCode } = request;
    const now = new Date().toISOString();

    // 1. Verificação de Permissão do Principal
    const permissionRequired = this.getRequiredPermission(actionType);
    const hasPermission = this.checkPrincipalPermission(principal.permissions, permissionRequired);

    if (!hasPermission) {
      this.logger.warn(
        `[SECURITY] [AUDIT] [ACTION_API] Ação '${actionType}' rejeitada para Principal '${principal.id}' (tipo: ${principal.type}, papéis: ${principal.roles.join(', ')}). Motivo: Permissão '${permissionRequired}' ausente.`,
      );

      return {
        success: false,
        actionType,
        principalId: principal.id,
        reasonCode: 'PERMISSION_DENIED',
        error: `Acesso negado: Requer a permissão '${permissionRequired}'`,
        timestamp: now,
      };
    }

    // 2. Roteamento e execução da ação solicitada
    switch (actionType) {
      case 'move':
        return this.handleMoveAction(request, now);

      case 'autonomous_navigation':
      case 'llm_deliberated_action':
        this.logger.log(
          `[AUDIT] [ACTION_API] Deliberação cognitiva '${actionType}' aprovada para Principal ${principal.id}`,
        );
        return {
          success: true,
          actionType,
          principalId: principal.id,
          reasonCode: reasonCode ?? 'COGNITIVE_ACTION_CONFIRMED',
          outcome: `Ação deliberada ${actionType} processada com sucesso`,
          data: parameters,
          timestamp: now,
        };

      case 'observe':
        return this.handleObserveAction(request, now);

      case 'speak':
        return this.handleSpeakAction(request, now);

      case 'interact':
        return this.handleInteractAction(request, now);

      case 'traffic_control':
        return this.handleTrafficControlAction(request, now);

      default:
        // Ação genérica customizada permitida pela política
        this.logger.log(
          `[AUDIT] [ACTION_API] Ação customizada '${actionType}' executada por Principal ${principal.id}`,
        );
        return {
          success: true,
          actionType,
          principalId: principal.id,
          reasonCode: reasonCode ?? 'CUSTOM_ACTION_EXECUTED',
          outcome: `Ação ${actionType} processada com sucesso`,
          data: parameters,
          timestamp: now,
        };
    }
  }

  /**
   * Mapeia a permissão requerida para cada tipo de ação.
   */
  private getRequiredPermission(actionType: string): string {
    switch (actionType) {
      case 'move':
      case 'autonomous_navigation':
      case 'llm_deliberated_action':
        return 'action:move';
      case 'observe':
        return 'action:observe';
      case 'speak':
        return 'action:speak';
      case 'interact':
        return 'action:interact';
      case 'traffic_control':
        return 'world:control';
      default:
        return `action:${actionType}`;
    }
  }

  /**
   * Valida se a lista de permissões contém a permissão solicitada ou o wildcard '*'.
   */
  private checkPrincipalPermission(permissions: string[], required: string): boolean {
    if (permissions.includes('*')) return true;
    return permissions.includes(required);
  }

  /**
   * Processa a ação física de movimento com validação anti-colisão e anti-phasing.
   */
  private async handleMoveAction(request: ActionRequest, now: string): Promise<ActionResult> {
    const { principal, parameters, reasonCode } = request;
    const x = Number(parameters['x'] ?? 0);
    const y = Number(parameters['y'] ?? 0);
    const z = Number(parameters['z'] ?? 0);

    const prevPos = this.lastKnownPositions.get(principal.id);
    const currentTimeMs = Date.now();
    const nextPos: PositionPoint = { x, y, z, timestamp: currentTimeMs };

    const validation = validateAvatarMovement(prevPos, nextPos, currentTimeMs);
    if (!validation.valid) {
      this.logger.warn(
        `[SECURITY] [AUDIT] [ACTION_API] Movimento inválido para ${principal.id}: ${validation.reason}`,
      );

      return {
        success: false,
        actionType: 'move',
        principalId: principal.id,
        reasonCode: 'PHYSICAL_CONSTRAINT_VIOLATION',
        error: validation.reason,
        timestamp: now,
      };
    }

    // Atualiza última posição conhecida
    this.lastKnownPositions.set(principal.id, nextPos);

    // Emite broadcast para clientes conectados via Socket.IO
    this.worldGateway?.broadcastDomainEvent({
      name: 'agent.moved',
      payload: {
        principalId: principal.id,
        agentId: principal.agentId,
        position: { x, y, z },
        reasonCode: reasonCode ?? 'AUTONOMOUS_OR_INPUT_NAVIGATION',
      },
    });

    return {
      success: true,
      actionType: 'move',
      principalId: principal.id,
      reasonCode: reasonCode ?? 'NAVIGATION_CONFIRMED',
      outcome: 'Deslocamento espacial autorizado e propagado para a simulação',
      data: { position: { x, y, z } },
      timestamp: now,
    };
  }

  /**
   * Processa a ação de percepção / observação.
   */
  private async handleObserveAction(request: ActionRequest, now: string): Promise<ActionResult> {
    const { principal, targetId, parameters } = request;
    const trafficState = this.worldGateway?.getTrafficLightState() ?? 'green';

    return {
      success: true,
      actionType: 'observe',
      principalId: principal.id,
      outcome: 'Observação ambiental realizada com sucesso',
      data: {
        targetId,
        trafficLight: trafficState,
        observedAt: now,
        ...parameters,
      },
      timestamp: now,
    };
  }

  /**
   * Processa a ação de comunicação verbal.
   */
  private async handleSpeakAction(request: ActionRequest, now: string): Promise<ActionResult> {
    const { principal, parameters } = request;
    const message = String(parameters['message'] ?? '');

    this.logger.log(`[AUDIT] [SPEAK] Principal ${principal.id}: "${message}"`);

    this.worldGateway?.broadcastDomainEvent({
      name: 'agent.speech',
      payload: {
        principalId: principal.id,
        agentId: principal.agentId,
        message,
        timestamp: now,
      },
    });

    return {
      success: true,
      actionType: 'speak',
      principalId: principal.id,
      outcome: 'Comunicação verbal transmitida para a vizinhança urbana',
      data: { message },
      timestamp: now,
    };
  }

  /**
   * Processa interação com objeto ou mobiliário urbano.
   */
  private async handleInteractAction(request: ActionRequest, now: string): Promise<ActionResult> {
    const { principal, targetId, parameters } = request;

    this.logger.log(
      `[AUDIT] [INTERACT] Principal ${principal.id} interagiu com objeto ${targetId}`,
    );

    this.worldGateway?.broadcastDomainEvent({
      name: 'agent.interacted',
      payload: {
        principalId: principal.id,
        targetId,
        parameters,
      },
    });

    return {
      success: true,
      actionType: 'interact',
      principalId: principal.id,
      outcome: `Interação concluída com ${targetId}`,
      data: { targetId, parameters },
      timestamp: now,
    };
  }

  /**
   * Processa controle direto do semáforo municipal (restrito ao papel admin / permissão world:control).
   */
  private async handleTrafficControlAction(request: ActionRequest, now: string): Promise<ActionResult> {
    const { principal, parameters } = request;
    const state = parameters['state'] as TrafficLightSignal;

    if (!['green', 'yellow', 'red'].includes(state)) {
      return {
        success: false,
        actionType: 'traffic_control',
        principalId: principal.id,
        reasonCode: 'INVALID_SIGNAL_STATE',
        error: "Estado de semáforo inválido. Use 'green', 'yellow' ou 'red'.",
        timestamp: now,
      };
    }

    if (this.worldGateway) {
      this.worldGateway.setTrafficLightState(state, principal.id);
    }

    return {
      success: true,
      actionType: 'traffic_control',
      principalId: principal.id,
      reasonCode: 'TRAFFIC_CONTROL_OVERRIDE',
      outcome: `Sinalização semafórica municipal alterada para '${state}'`,
      data: { state },
      timestamp: now,
    };
  }
}
