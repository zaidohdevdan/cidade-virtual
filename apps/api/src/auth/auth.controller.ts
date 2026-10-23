// apps/api/src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthPrincipal } from './auth.types';
import type { UserProfileRow } from '@cidade-virtual/persistence';

@Controller('auth')
export class AuthController {
  private readonly authService: AuthService;

  constructor(@Optional() @Inject(AuthService) authService?: AuthService) {
    this.authService = authService ?? new AuthService();
  }

  /**
   * Endpoint público para o cliente 3D obter um token de sessão de convidado (Guest Principal).
   */
  @Post('guest-token')
  @HttpCode(HttpStatus.OK)
  createGuestToken(@Body() _body?: Record<string, unknown>): { token: string; user: AuthPrincipal } {
    return this.authService.createGuestToken();
  }

  /**
   * Endpoint público para o frontend obter o Google Client ID configurado na aplicação.
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  getAuthConfig(): { googleClientId: string } {
    return {
      googleClientId: this.authService.getGoogleClientId(),
    };
  }

  /**
   * Endpoint para troca de credencial administrativa por token JWT admin.
   */
  @Post('admin-token')
  @HttpCode(HttpStatus.OK)
  createAdminToken(@Body() body: { adminKey?: string }): { token: string; user: AuthPrincipal } {
    if (!body?.adminKey) {
      throw new UnauthorizedException('adminKey obrigatória');
    }
    return this.authService.createAdminToken(body.adminKey);
  }

  /**
   * Endpoint de login via Google OIDC (Task-043).
   * Recebe o idToken fornecido pelo Google Sign-In / One Tap no frontend.
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(@Body() body: { idToken?: string }): Promise<{
    token: string;
    user: AuthPrincipal;
    profile: UserProfileRow;
  }> {
    if (!body?.idToken) {
      throw new BadRequestException('O campo idToken é obrigatório');
    }
    return this.authService.loginWithGoogle(body.idToken);
  }

  /**
   * Retorna os dados do Principal autenticado via cabeçalho Authorization.
   */
  @Get('me')
  getMe(@Headers('authorization') authHeader?: string): AuthPrincipal {
    return this.extractAuthenticatedPrincipal(authHeader);
  }

  /**
   * Retorna o perfil completo do usuário autenticado incluindo preferências e avatarConfig (Task-043).
   */
  @Get('profile')
  async getProfile(@Headers('authorization') authHeader?: string): Promise<UserProfileRow> {
    const principal = this.extractAuthenticatedPrincipal(authHeader);
    return this.authService.getUserProfile(principal.userId);
  }

  /**
   * Atualiza a configuração do avatar do usuário autenticado de forma persistente (Task-043).
   */
  @Put('profile/avatar')
  async updateAvatar(
    @Headers('authorization') authHeader?: string,
    @Body() body?: { avatarConfig?: unknown },
  ): Promise<UserProfileRow> {
    const principal = this.extractAuthenticatedPrincipal(authHeader);
    if (!body || body.avatarConfig === undefined) {
      throw new BadRequestException('O campo avatarConfig é obrigatório');
    }
    return this.authService.updateAvatarConfig(principal.userId, body.avatarConfig);
  }

  private extractAuthenticatedPrincipal(authHeader?: string): AuthPrincipal {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Cabeçalho Authorization com formato Bearer obrigatório');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return this.authService.validateToken(token);
  }
}
