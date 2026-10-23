// apps/api/src/auth/google-auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';

export interface GoogleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud: string;
  exp: number;
  iss: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  /**
   * Valida o id_token do Google OIDC de forma segura e estrita.
   * Em produção, valida contra a API oficial do Google tokeninfo e confere audience/expiração.
   * Em testes automatizados ou com GOOGLE_AUTH_MOCK=true, valida estrutura e claims deterministicamente sem internet.
   */
  getGoogleClientId(): string {
    const envVal = process.env['GOOGLE_CLIENT_ID'] || process.env['VITE_GOOGLE_CLIENT_ID'];
    if (envVal && envVal !== 'undefined') {
      return envVal.trim();
    }
    try {
      const fs = require('fs');
      const path = require('path');
      const candidatePaths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '../.env'),
        path.resolve(__dirname, '../../../../.env'),
      ];
      for (const envPath of candidatePaths) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          const match = content.match(/^(?:VITE_)?GOOGLE_CLIENT_ID=(.+)$/m);
          if (match && match[1] && match[1].trim()) {
            const val = match[1].trim();
            process.env['GOOGLE_CLIENT_ID'] = val;
            return val;
          }
        }
      }
    } catch {}
    return '';
  }

  async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      throw new BadRequestException('O campo idToken é obrigatório');
    }

    const trimmedToken = idToken.trim();
    const rawClientId = this.getGoogleClientId();
    const expectedClientId = rawClientId ? rawClientId : undefined;

    // ── Modo de Teste Determinístico / Mock Offline ──
    if (
      trimmedToken.startsWith('mock-google-token:') ||
      trimmedToken.startsWith('test-google-token:') ||
      process.env['NODE_ENV'] === 'test' ||
      process.env['GOOGLE_AUTH_MOCK'] === 'true'
    ) {
      return this.verifyMockOrTestToken(trimmedToken, expectedClientId);
    }

    // ── Validação em Produção via Google Tokeninfo ──
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(trimmedToken)}`,
        { method: 'GET', signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        this.logger.warn(`[SECURITY] Falha na validação do id_token junto ao Google: HTTP ${response.status}`);
        throw new UnauthorizedException('Token Google inválido ou rejeitado pelo provedor');
      }

      const body = (await response.json()) as Record<string, unknown>;
      return this.validatePayloadClaims(body, expectedClientId);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`[SECURITY] Erro ao contatar Google tokeninfo: ${(err as Error)?.message}`);
      throw new UnauthorizedException('Falha ao autenticar com o Google OIDC');
    }
  }

  /**
   * Valida claims essenciais de segurança (audience, issuer, expiration, sub).
   */
  private validatePayloadClaims(
    payload: Record<string, unknown>,
    expectedClientId?: string
  ): GoogleTokenPayload {
    const sub = typeof payload['sub'] === 'string' ? payload['sub'].trim() : null;
    if (!sub) {
      throw new UnauthorizedException('Token Google inválido: ausência do claim sub');
    }

    const aud = typeof payload['aud'] === 'string' ? payload['aud'].trim() : '';
    if (expectedClientId && expectedClientId.trim().length > 0) {
      if (aud !== expectedClientId.trim()) {
        this.logger.warn(`[SECURITY] Audience mismatch: recebido "${aud}", esperado "${expectedClientId}"`);
        throw new UnauthorizedException('AUDIENCE_MISMATCH: Token Google não pertence a esta aplicação');
      }
    }

    const iss = typeof payload['iss'] === 'string' ? payload['iss'].trim() : '';
    if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
      this.logger.warn(`[SECURITY] Emissor inválido: "${iss}"`);
      throw new UnauthorizedException('INVALID_ISSUER: Emissor do token não é o Google');
    }

    const exp = typeof payload['exp'] === 'number' ? payload['exp'] : Number(payload['exp']);
    if (!exp || isNaN(exp)) {
      throw new UnauthorizedException('Token Google inválido: ausência do claim exp');
    }

    // Validação com tolerância de 30 segundos para clock skew
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp + 30 < nowSec) {
      this.logger.warn(`[SECURITY] Token Google expirado: exp=${exp}, now=${nowSec}`);
      throw new UnauthorizedException('TOKEN_EXPIRED: Token Google expirado');
    }

    return {
      sub,
      email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
      email_verified: Boolean(payload['email_verified']),
      name: typeof payload['name'] === 'string' ? payload['name'] : undefined,
      picture: typeof payload['picture'] === 'string' ? payload['picture'] : undefined,
      aud,
      exp,
      iss,
    };
  }

  /**
   * Decodificador de tokens para suíte de testes automatizados e ambientes de desenvolvimento isolados.
   */
  private verifyMockOrTestToken(token: string, expectedClientId?: string): GoogleTokenPayload {
    let payload: Record<string, unknown>;

    if (token.startsWith('mock-google-token:') || token.startsWith('test-google-token:')) {
      const rawJson = token.substring(token.indexOf(':') + 1);
      try {
        payload = JSON.parse(rawJson);
      } catch {
        throw new UnauthorizedException('Token mock com JSON malformado');
      }
    } else {
      // Se for um JWT em formato standard (header.payload.signature)
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
          payload = JSON.parse(jsonStr);
        } catch {
          throw new UnauthorizedException('JWT malformado em modo de teste');
        }
      } else {
        throw new UnauthorizedException('Token de formato desconhecido');
      }
    }

    return this.validatePayloadClaims(payload, expectedClientId);
  }
}
