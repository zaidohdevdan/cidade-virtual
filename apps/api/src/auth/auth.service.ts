// apps/api/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { signJwtToken, verifyJwtToken } from './jwt.util';
import type { AuthPrincipal } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Gera token efêmero de convidado (Guest Principal) para o cliente Web 3D.
   */
  createGuestToken(): { token: string; user: AuthPrincipal } {
    const userId = `guest_${crypto.randomBytes(8).toString('hex')}`;
    const user: AuthPrincipal = {
      userId,
      role: 'guest',
      scenarioId: 'rua-central-main',
    };
    const token = signJwtToken(user, '24h');
    this.logger.log(`[SECURITY] [AUDIT] Token de convidado emitido para: ${userId}`);
    return { token, user };
  }

  /**
   * Valida chave de administrador e gera token de Admin Principal.
   */
  createAdminToken(adminKey: string): { token: string; user: AuthPrincipal } {
    const configuredKey = process.env['ADMIN_KEY'];
    if (!configuredKey || adminKey !== configuredKey) {
      this.logger.warn(`[SECURITY] [AUDIT] Tentativa falha de obtenção de token admin`);
      throw new UnauthorizedException('Chave administrativa inválida');
    }

    const user: AuthPrincipal = {
      userId: 'admin_root',
      role: 'admin',
      scenarioId: 'rua-central-main',
    };
    const token = signJwtToken(user, '12h');
    this.logger.log(`[SECURITY] [AUDIT] Token de administrador emitido`);
    return { token, user };
  }

  /**
   * Valida token JWT fornecido.
   */
  validateToken(token: string): AuthPrincipal {
    try {
      return verifyJwtToken(token);
    } catch (err: any) {
      this.logger.warn(`[SECURITY] [AUDIT] Falha na validação de token: ${err.message}`);
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
