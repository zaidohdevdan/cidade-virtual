// apps/api/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { z } from 'zod';
import { signJwtToken, verifyJwtToken } from './jwt.util';
import type { AuthPrincipal } from './auth.types';
import { GoogleAuthService } from './google-auth.service';
import { MarketplaceRepository, type UserProfileRow } from '@cidade-virtual/persistence';

export const AvatarConfigSchema = z.object({
  model: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/).default('casual_male_1'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#004CBF'),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFD000'),
  skinTone: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  hairColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accessories: z.array(z.string().min(1).max(32)).max(10).default([]),
});

export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  model: 'casual_male_1',
  primaryColor: '#004CBF', // Azul Petz
  secondaryColor: '#FFD000', // Amarelo Petz
  skinTone: '#f5cfb3',
  hairColor: '#261b17',
  accessories: ['glasses'],
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Optional() @Inject(GoogleAuthService)
    private readonly googleAuthService: GoogleAuthService = new GoogleAuthService(),
    @Optional() @Inject(MarketplaceRepository)
    private readonly marketplaceRepo?: MarketplaceRepository,
  ) {}

  /**
   * Obtém o Client ID do Google OAuth configurado.
   */
  getGoogleClientId(): string {
    return this.googleAuthService.getGoogleClientId();
  }

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
   * Login via Google OIDC (Task-043).
   * Valida o id_token, recupera ou inicializa perfil no banco e gera JWT da sessão.
   */
  async loginWithGoogle(idToken: string): Promise<{
    token: string;
    user: AuthPrincipal;
    profile: UserProfileRow;
  }> {
    const payload = await this.googleAuthService.verifyGoogleIdToken(idToken);
    const userId = payload.sub;

    let profile: UserProfileRow;

    if (this.marketplaceRepo) {
      const existing = await this.marketplaceRepo.getUserProfile(userId);
      if (existing) {
        // Atualiza display name ou email caso tenham mudado na conta Google
        profile = await this.marketplaceRepo.upsertUserProfile({
          id: userId,
          email: payload.email || existing.email,
          displayName: payload.name || existing.displayName || payload.email?.split('@')[0] || 'Explorador',
          avatarConfig: existing.avatarConfig,
        });
        this.logger.log(`[SECURITY] [AUDIT] Usuário Google existente logado: ${userId} (${profile.email})`);
      } else {
        // Novo usuário: define avatar padrão
        profile = await this.marketplaceRepo.upsertUserProfile({
          id: userId,
          email: payload.email || null,
          displayName: payload.name || payload.email?.split('@')[0] || 'Explorador',
          avatarConfig: DEFAULT_AVATAR_CONFIG,
        });
        this.logger.log(`[SECURITY] [AUDIT] Novo perfil de usuário criado via Google OIDC: ${userId}`);
      }
    } else {
      // Fallback em memória para contextos isolados
      profile = {
        id: userId,
        email: payload.email || null,
        displayName: payload.name || 'Explorador',
        avatarConfig: DEFAULT_AVATAR_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const user: AuthPrincipal = {
      userId,
      role: 'citizen',
      clientId: 'web-client',
      scenarioId: 'rua-central-main',
    };

    const token = signJwtToken(user, '24h');
    return { token, user, profile };
  }

  /**
   * Retorna o perfil do usuário autenticado incluindo configuração do avatar.
   */
  async getUserProfile(userId: string): Promise<UserProfileRow> {
    if (!this.marketplaceRepo) {
      return {
        id: userId,
        email: null,
        displayName: 'Explorador',
        avatarConfig: DEFAULT_AVATAR_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const profile = await this.marketplaceRepo.getUserProfile(userId);
    if (!profile) {
      throw new NotFoundException(`Perfil para o usuário ${userId} não encontrado`);
    }
    return profile;
  }

  /**
   * Atualiza a configuração do avatar do usuário de forma segura e validada.
   */
  async updateAvatarConfig(userId: string, rawConfig: unknown): Promise<UserProfileRow> {
    const parseResult = AvatarConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new BadRequestException(`Configuração de avatar inválida: ${issues}`);
    }

    const validConfig = parseResult.data;

    if (!this.marketplaceRepo) {
      return {
        id: userId,
        email: null,
        displayName: 'Explorador',
        avatarConfig: validConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const existing = await this.marketplaceRepo.getUserProfile(userId);
    const updated = await this.marketplaceRepo.upsertUserProfile({
      id: userId,
      email: existing?.email || null,
      displayName: existing?.displayName || 'Explorador',
      avatarConfig: validConfig,
    });

    this.logger.log(`[SECURITY] [AUDIT] Configuração de avatar atualizada para o usuário: ${userId}`);
    return updated;
  }

  /**
   * Valida token JWT fornecido.
   */
  validateToken(token: string): AuthPrincipal {
    try {
      return verifyJwtToken(token);
    } catch (err: unknown) {
      this.logger.warn(`[SECURITY] [AUDIT] Falha na validação de token: ${(err as Error)?.message || String(err)}`);
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
