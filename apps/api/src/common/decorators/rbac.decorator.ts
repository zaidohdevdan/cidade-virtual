// apps/api/src/common/decorators/rbac.decorator.ts
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PrincipalRole, Principal } from '@cidade-virtual/types';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: PrincipalRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator para injetar o Principal autenticado diretamente no parâmetro do endpoint.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.principal;
  },
);
