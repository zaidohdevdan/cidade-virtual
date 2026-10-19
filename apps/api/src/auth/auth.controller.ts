// apps/api/src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Headers,
  UnauthorizedException,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthPrincipal } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint público para o cliente 3D obter um token de sessão de convidado (Guest Principal).
   */
  @Post('guest-token')
  @HttpCode(HttpStatus.OK)
  createGuestToken(): { token: string; user: AuthPrincipal } {
    return this.authService.createGuestToken();
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
   * Retorna os dados do Principal autenticado via cabeçalho Authorization.
   */
  @Get('me')
  getMe(@Headers('authorization') authHeader?: string): AuthPrincipal {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Cabeçalho Authorization com formato Bearer obrigatório');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return this.authService.validateToken(token);
  }
}
