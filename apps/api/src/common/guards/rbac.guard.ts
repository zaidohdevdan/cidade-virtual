// apps/api/src/common/guards/rbac.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Principal, PrincipalRole } from '@cidade-virtual/types';
import { createPrincipal } from '@cidade-virtual/types';
import { ROLES_KEY, PERMISSIONS_KEY } from '../decorators/rbac.decorator';
import { verifyJwtToken } from '../../auth/jwt.util';

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PrincipalRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se nenhuma restrição de role ou permissão for solicitada, permite acesso
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let principal: Principal | undefined = request.principal;

    // Se ainda não houver Principal resolvido, extrai do Header Authorization (Bearer JWT)
    if (!principal) {
      const authHeader = request.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        try {
          const authUser = verifyJwtToken(token);
          principal = createPrincipal({
            id: authUser.userId,
            type: authUser.role === 'admin' ? 'human' : 'human',
            roles: [authUser.role as PrincipalRole],
            displayName: authUser.userId,
          });
          request.principal = principal;
        } catch (err: unknown) {
          this.logger.warn(`[SECURITY] [AUDIT] [RBAC] Falha ao verificar token: ${(err as Error)?.message || String(err)}`);
          throw new UnauthorizedException('Token inválido ou expirado');
        }
      } else if (request.body?.principal) {
        // Suporte a chamadas com Principal embutido (ex: invocação interna de NPC / workers)
        const p = request.body.principal;
        principal = createPrincipal({
          id: p.id,
          type: p.type ?? 'human',
          roles: p.roles ?? ['guest'],
          agentId: p.agentId,
          displayName: p.displayName,
          customPermissions: p.permissions,
        });
        request.principal = principal;
      }
    }

    if (!principal) {
      this.logger.warn('[SECURITY] [AUDIT] [RBAC] Rejeitado: Principal não autenticado');
      throw new UnauthorizedException('Autenticação requerida');
    }

    // 1. Validação de Papéis (Roles)
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = principal.roles.some((r) => requiredRoles.includes(r));
      if (!hasRole && !principal.roles.includes('admin')) {
        this.logger.warn(
          `[SECURITY] [AUDIT] [RBAC] Acesso negado para Principal ${principal.id}: Papéis requeridos [${requiredRoles.join(', ')}], possuídos [${principal.roles.join(', ')}]`,
        );
        throw new ForbiddenException(
          `Acesso negado: Requer um dos seguintes papéis: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // 2. Validação de Permissões (Permissions)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasWildcard = principal.permissions.includes('*');
      const hasAllPermissions = requiredPermissions.every((perm) =>
        principal!.permissions.includes(perm),
      );

      if (!hasWildcard && !hasAllPermissions) {
        this.logger.warn(
          `[SECURITY] [AUDIT] [RBAC] Acesso negado para Principal ${principal.id}: Permissões requeridas [${requiredPermissions.join(', ')}], possuídas [${principal.permissions.join(', ')}]`,
        );
        throw new ForbiddenException(
          `Acesso negado: Permissões insuficientes (${requiredPermissions.join(', ')})`,
        );
      }
    }

    return true;
  }
}
