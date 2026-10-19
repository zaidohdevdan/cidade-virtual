// tests/integration/principal-actions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPrincipal,
  ActionRequest,
  ActionResult,
  Principal,
  CitizenId,
} from '@cidade-virtual/types';
import { ActionsService } from '../../apps/api/src/modules/actions/actions.service';
import { ActionsController } from '../../apps/api/src/modules/actions/actions.controller';
import { WorldGateway } from '../../apps/api/src/gateways/world.gateway';
import { CognitiveCycleManager } from '../../packages/agent-cognition';
import { RbacGuard } from '../../apps/api/src/common/guards/rbac.guard';
import { Reflector } from '@nestjs/core';
import type { Socket } from 'socket.io';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { signJwtToken, _resetEphemeralSecretForTesting } from '../../apps/api/src/auth/jwt.util';

describe('Task-025 — Contrato Principal + AgentAction API e RBAC', () => {
  let gateway: WorldGateway;
  let actionsService: ActionsService;
  let actionsController: ActionsController;
  let cognitiveManager: CognitiveCycleManager;

  beforeEach(() => {
    gateway = new WorldGateway();
    actionsService = new ActionsService(gateway);
    gateway.setActionsService(actionsService);
    actionsController = new ActionsController(actionsService);
    cognitiveManager = new CognitiveCycleManager();
  });

  afterEach(() => {
    gateway.destroy();
    _resetEphemeralSecretForTesting();
  });

  describe('1. Criação e Resolução Canônica de Principals', () => {
    it('deve criar Principal com permissões padrão inferidas de seus papéis', () => {
      const citizenPrincipal = createPrincipal({
        id: 'agent-sulafat',
        type: 'npc',
        roles: ['citizen'],
        agentId: 'agent-sulafat',
        displayName: 'Sulafat',
      });

      expect(citizenPrincipal.id).toBe('agent-sulafat');
      expect(citizenPrincipal.type).toBe('npc');
      expect(citizenPrincipal.roles).toEqual(['citizen']);
      expect(citizenPrincipal.permissions).toContain('action:move');
      expect(citizenPrincipal.permissions).toContain('action:observe');
      expect(citizenPrincipal.permissions).toContain('action:speak');
      expect(citizenPrincipal.permissions).toContain('action:interact');
      expect(citizenPrincipal.permissions).not.toContain('world:control');
      expect(citizenPrincipal.permissions).not.toContain('*');
    });

    it('um Principal com papel admin deve possuir permissão wildcard (*)', () => {
      const adminPrincipal = createPrincipal({
        id: 'admin_daniel',
        type: 'human',
        roles: ['admin'],
        displayName: 'Daniel (Admin)',
      });

      expect(adminPrincipal.roles).toContain('admin');
      expect(adminPrincipal.permissions).toContain('*');
    });

    it('um Principal convidado (guest) deve possuir apenas permissões de observação e movimento', () => {
      const guestPrincipal = createPrincipal({
        id: 'guest_visitor',
        type: 'human',
        roles: ['guest'],
      });

      expect(guestPrincipal.permissions).toContain('action:move');
      expect(guestPrincipal.permissions).toContain('action:observe');
      expect(guestPrincipal.permissions).not.toContain('action:speak');
      expect(guestPrincipal.permissions).not.toContain('world:control');
    });
  });

  describe('2. RBAC e Rejeição Auditável de Recursos Não Autorizados (Critério de Aceite 1)', () => {
    it('deve rejeitar tentativa de controle de semáforo por NPC ou cidadão com motivo auditável', async () => {
      const npcPrincipal = createPrincipal({
        id: 'agent-vega',
        type: 'npc',
        roles: ['citizen'],
        agentId: 'agent-vega',
      });

      const request: ActionRequest = {
        principal: npcPrincipal,
        actionType: 'traffic_control',
        parameters: { state: 'red' },
      };

      const result = await actionsService.executeAction(request);

      expect(result.success).toBe(false);
      expect(result.reasonCode).toBe('PERMISSION_DENIED');
      expect(result.error).toContain("Requer a permissão 'world:control'");
      expect(result.actionType).toBe('traffic_control');
      expect(result.principalId).toBe('agent-vega');
    });

    it('deve permitir controle de semáforo quando executado por Principal com papel admin', async () => {
      const adminPrincipal = createPrincipal({
        id: 'admin_daniel',
        type: 'human',
        roles: ['admin'],
      });

      const request: ActionRequest = {
        principal: adminPrincipal,
        actionType: 'traffic_control',
        parameters: { state: 'red' },
      };

      const result = await actionsService.executeAction(request);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('traffic_control');
      expect(result.reasonCode).toBe('TRAFFIC_CONTROL_OVERRIDE');
      expect(result.data?.state).toBe('red');
    });

    it('RbacGuard deve barrar requisições HTTP REST sem o papel ou permissão necessária', () => {
      const reflector = new Reflector();
      const guard = new RbacGuard(reflector);

      // Mock de contexto para endpoint que exige papel admin
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === 'roles') return ['admin'];
        return undefined;
      });

      const mockExecutionContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            principal: createPrincipal({
              id: 'agent-chason',
              type: 'npc',
              roles: ['citizen'],
            }),
          }),
        }),
      } as any;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });

  describe('3. Execução Unificada da Ação Move via HTTP REST e Socket.IO (Critério de Aceite 2)', () => {
    it('deve executar a ação move com sucesso via HTTP REST (ActionsController)', async () => {
      const citizenPrincipal = createPrincipal({
        id: 'agent-sheliak',
        type: 'npc',
        roles: ['citizen'],
        agentId: 'agent-sheliak',
      });

      const restResult = await actionsController.execute(
        {
          principal: citizenPrincipal,
          actionType: 'move',
          parameters: { x: 5, y: 0.19, z: -10 },
          reasonCode: 'REST_AGENT_MOVE',
        },
        citizenPrincipal,
      );

      expect(restResult.success).toBe(true);
      expect(restResult.actionType).toBe('move');
      expect(restResult.principalId).toBe('agent-sheliak');
      expect(restResult.data).toEqual({ position: { x: 5, y: 0.19, z: -10 } });
    });

    it('deve executar a ação move com sucesso via Socket.IO Gateway (WorldGateway)', async () => {
      const mockSocket = {
        id: 'socket_sheliak_123',
        data: {
          user: {
            userId: 'agent-sheliak',
            role: 'citizen',
          },
        },
        emit: vi.fn(),
        broadcast: { emit: vi.fn() },
      } as unknown as Socket;

      const socketResult = await gateway.handleAgentAction(mockSocket, {
        actionType: 'move',
        parameters: { x: 5.5, y: 0.19, z: -10.5 },
        reasonCode: 'SOCKET_AGENT_MOVE',
      });

      expect(socketResult.success).toBe(true);
      expect(socketResult.actionType).toBe('move');
      expect(socketResult.principalId).toBe('agent-sheliak');
      expect(socketResult.data).toEqual({ position: { x: 5.5, y: 0.19, z: -10.5 } });

      // Garante que o gateway respondeu ao cliente via evento socket
      expect(mockSocket.emit).toHaveBeenCalledWith('agent:action:result', expect.objectContaining({
        success: true,
        actionType: 'move',
      }));
    });

    it('deve rejeitar movimento com colisão física server-side em ambos os canais', async () => {
      const citizenPrincipal = createPrincipal({
        id: 'agent-vega',
        type: 'npc',
        roles: ['citizen'],
      });

      // Posição colidindo com Edifício Comercial Bloco A (x: -25, z: -15, width: 20, depth: 16)
      const collisionRequest: ActionRequest = {
        principal: citizenPrincipal,
        actionType: 'move',
        parameters: { x: -25, y: 0.19, z: -15 },
      };

      const result = await actionsService.executeAction(collisionRequest);
      expect(result.success).toBe(false);
      expect(result.reasonCode).toBe('PHYSICAL_CONSTRAINT_VIOLATION');
      expect(result.error).toMatch(/colide com obstáculo/i);
    });
  });

  describe('4. Interoperabilidade com o Grafo Cognitivo (CognitiveCycleManager)', () => {
    it('deve emitir ActionRequest assinado pelo Principal e executar via AgentAction API', async () => {
      const agentId = 'agent-epsilon' as CitizenId;
      const observation = 'Avenida limpa e semáforo aberto para travessia';

      // 1. Deliberação cognitiva gera ActionRequest canônico
      const actionRequest = await cognitiveManager.evaluateActionRequest(
        agentId,
        observation,
        'semaforo-1',
      );

      expect(actionRequest.principal.id).toBe(`principal_${agentId}`);
      expect(actionRequest.principal.type).toBe('npc');
      expect(actionRequest.principal.roles).toContain('citizen');
      expect(actionRequest.actionType).toBe('autonomous_navigation');
      expect(actionRequest.reasonCode).toBe('UTILITY_EVALUATION');
      expect(actionRequest.correlationId).toBeDefined();

      // 2. ActionsService processa a ação resultante com autorização e sucesso
      const result = await actionsService.executeAction(actionRequest);
      expect(result.success).toBe(true);
      expect(result.principalId).toBe(`principal_${agentId}`);
      expect(result.outcome).toMatch(/processada com sucesso/i);
    });
  });
});
