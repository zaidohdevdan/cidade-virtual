// apps/api/src/modules/actions/actions.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { ActionRequest, ActionResult, Principal } from '@cidade-virtual/types';
import { ActionsService } from './actions.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { CurrentPrincipal } from '../../common/decorators/rbac.decorator';

@Controller('actions')
@UseGuards(RbacGuard)
export class ActionsController {
  constructor(@Inject(ActionsService) private readonly actionsService: ActionsService) {}

  /**
   * Endpoint canônico da AgentAction API (Task-025).
   * Executa ações tipadas para qualquer Principal (Humano, NPC, Agente Externo MCP).
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(
    @Body() body: Partial<ActionRequest>,
    @CurrentPrincipal() authenticatedPrincipal?: Principal,
  ): Promise<ActionResult> {
    const principal = authenticatedPrincipal ?? body.principal;

    if (!principal) {
      throw new BadRequestException('Principal obrigatório na requisição ou no cabeçalho de autenticação');
    }

    if (!body.actionType) {
      throw new BadRequestException("Campo 'actionType' é obrigatório");
    }

    const request: ActionRequest = {
      principal,
      actionType: body.actionType,
      targetId: body.targetId,
      parameters: body.parameters ?? {},
      reasonCode: body.reasonCode,
      correlationId: body.correlationId ?? crypto.randomUUID(),
      timestamp: body.timestamp ?? new Date().toISOString(),
    };

    return this.actionsService.executeAction(request);
  }

  /**
   * Atalho REST para ação de movimento (move).
   */
  @Post('move')
  @HttpCode(HttpStatus.OK)
  async move(
    @Body() body: { x: number; y?: number; z: number; reasonCode?: string; principal?: Principal },
    @CurrentPrincipal() authenticatedPrincipal?: Principal,
  ): Promise<ActionResult> {
    const principal = authenticatedPrincipal ?? body.principal;
    if (!principal) {
      throw new BadRequestException('Principal obrigatório');
    }

    return this.actionsService.executeAction({
      principal,
      actionType: 'move',
      parameters: { x: body.x, y: body.y ?? 0, z: body.z },
      reasonCode: body.reasonCode ?? 'REST_NAVIGATION',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }
}
