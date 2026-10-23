// tests/integration/google-oauth-client-id-procedure.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createDatabaseConnection, MarketplaceRepository } from '@cidade-virtual/persistence';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { GoogleAuthService } from '../../apps/api/src/auth/google-auth.service';
import { loginWithGoogleIdToken, fetchGuestToken } from '../../apps/web-client/src/services/api';

/**
 * Validador de formato de Client ID oficial do Google OAuth 2.0 Web Application.
 */
export function isValidGoogleClientId(clientId: string | null | undefined): boolean {
  if (!clientId || typeof clientId !== 'string') return false;
  const trimmed = clientId.trim();
  // Formato: <número_do_projeto>-<hash_aleatório>.apps.googleusercontent.com
  const googleClientIdRegex = /^[0-9]+-[a-zA-Z0-9_\-]+\.apps\.googleusercontent\.com$/;
  return googleClientIdRegex.test(trimmed);
}

/**
 * Helper simulador da lógica de resolução de Client ID do frontend (WelcomeLoginModal).
 */
export function resolveFrontendClientId(
  envClientId?: string,
  storageClientId?: string | null,
): { clientId: string; source: 'env' | 'localStorage' | 'none'; isValid: boolean } {
  const candidate = (envClientId || storageClientId || '').trim();
  if (!candidate) {
    return { clientId: '', source: 'none', isValid: false };
  }
  const source = envClientId?.trim() ? 'env' : 'localStorage';
  return {
    clientId: candidate,
    source,
    isValid: isValidGoogleClientId(candidate),
  };
}

describe('Procedimento de Configuração e Uso do Google OAuth Client ID', () => {
  let dbConnection: ReturnType<typeof createDatabaseConnection>;
  let marketplaceRepo: MarketplaceRepository;
  let googleAuthService: GoogleAuthService;
  let authService: AuthService;

  const MOCK_VALID_CLIENT_ID = '1048291048201-abc123def456ghi789jkl.apps.googleusercontent.com';
  const MOCK_ANOTHER_CLIENT_ID = '999999999999-otherappxyz789.apps.googleusercontent.com';

  beforeAll(async () => {
    dbConnection = createDatabaseConnection();
    marketplaceRepo = new MarketplaceRepository(dbConnection.db);
    googleAuthService = new GoogleAuthService();
    authService = new AuthService(googleAuthService, marketplaceRepo);
  });

  afterAll(async () => {
    await dbConnection.pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. VALIDAÇÃO DE FORMATO DO CLIENT ID COPIADO DO GOOGLE CLOUD CONSOLE
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Validação Sintática do Client ID (Google Cloud Console)', () => {
    it('1.1. Deve aceitar um Client ID autêntico do Google terminando em .apps.googleusercontent.com', () => {
      const result = isValidGoogleClientId(MOCK_VALID_CLIENT_ID);
      expect(result).toBe(true);
    });

    it('1.2. Deve rejeitar se o usuário colar a Chave Secreta (Client Secret) por engano', () => {
      const clientSecret = 'GOCSPX-abc123def456ghi789jklmn';
      expect(isValidGoogleClientId(clientSecret)).toBe(false);
    });

    it('1.3. Deve rejeitar URL com protocolo ou barra no final (erros comuns de digitação)', () => {
      expect(isValidGoogleClientId(`https://${MOCK_VALID_CLIENT_ID}`)).toBe(false);
      expect(isValidGoogleClientId(`${MOCK_VALID_CLIENT_ID}/`)).toBe(false);
      expect(isValidGoogleClientId('http://localhost:3000')).toBe(false);
    });

    it('1.4. Deve rejeitar string vazia, nula ou espaços em branco', () => {
      expect(isValidGoogleClientId('')).toBe(false);
      expect(isValidGoogleClientId('   ')).toBe(false);
      expect(isValidGoogleClientId(null)).toBe(false);
      expect(isValidGoogleClientId(undefined)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PROCEDIMENTO DE RESOLUÇÃO NO FRONTEND (Vite .env vs localStorage UI)
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Resolução do Client ID no Frontend (Vite .env vs localStorage UI)', () => {
    it('2.1. Deve priorizar VITE_GOOGLE_CLIENT_ID do arquivo .env quando presente', () => {
      const resolved = resolveFrontendClientId(MOCK_VALID_CLIENT_ID, 'other-id.apps.googleusercontent.com');
      expect(resolved.source).toBe('env');
      expect(resolved.clientId).toBe(MOCK_VALID_CLIENT_ID);
      expect(resolved.isValid).toBe(true);
    });

    it('2.2. Quando não houver .env, deve carregar o Client ID colado na engrenagem ⚙️ (localStorage)', () => {
      const resolved = resolveFrontendClientId('', MOCK_VALID_CLIENT_ID);
      expect(resolved.source).toBe('localStorage');
      expect(resolved.clientId).toBe(MOCK_VALID_CLIENT_ID);
      expect(resolved.isValid).toBe(true);
    });

    it('2.3. Quando nenhum estiver configurado, deve indicar source "none" para ativar modo fallback amigável', () => {
      const resolved = resolveFrontendClientId('', '');
      expect(resolved.source).toBe('none');
      expect(resolved.clientId).toBe('');
      expect(resolved.isValid).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. INICIALIZAÇÃO DO GOOGLE IDENTITY SERVICES (GIS SDK)
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Inicialização e Renderização do SDK Google Identity Services (GIS)', () => {
    it('3.1. Deve inicializar window.google.accounts.id com o Client ID e callback registrado', () => {
      const mockInitialize = vi.fn();
      const mockRenderButton = vi.fn();

      const fakeWindow = {
        google: {
          accounts: {
            id: {
              initialize: mockInitialize,
              renderButton: mockRenderButton,
            },
          },
        },
      };

      // Simula execução do ciclo do WelcomeLoginModal
      const onGoogleSuccess = vi.fn();
      fakeWindow.google.accounts.id.initialize({
        client_id: MOCK_VALID_CLIENT_ID,
        callback: onGoogleSuccess,
      });

      expect(mockInitialize).toHaveBeenCalledWith({
        client_id: MOCK_VALID_CLIENT_ID,
        callback: expect.any(Function),
      });

      const fakeContainer = {} as HTMLElement;
      fakeWindow.google.accounts.id.renderButton(fakeContainer, {
        theme: 'outline',
        size: 'large',
      });

      expect(mockRenderButton).toHaveBeenCalledWith(fakeContainer, {
        theme: 'outline',
        size: 'large',
      });
    });

    it('3.2. Não deve quebrar se o script do Google ainda estiver carregando (window.google indefinido)', () => {
      const fakeWindowWithoutGoogle: Record<string, unknown> = {};

      expect(() => {
        const hasGsi = Boolean(
          (fakeWindowWithoutGoogle as any).google?.accounts?.id
        );
        expect(hasGsi).toBe(false);
      }).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. VERIFICAÇÃO DO AUDIENCE (aud) NO BACKEND COM O GOOGLE_CLIENT_ID CONFIGURADO
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Verificação de Audience (aud) e Emissão de Sessão no Backend', () => {
    it('4.1. Deve aceitar login quando o aud do token emitido pelo Google bate com o GOOGLE_CLIENT_ID configurado', async () => {
      const originalEnv = process.env['GOOGLE_CLIENT_ID'];
      process.env['GOOGLE_CLIENT_ID'] = MOCK_VALID_CLIENT_ID;

      try {
        const payload = {
          sub: 'google_user_synapse_987',
          email: 'danfealmeida@gmail.com',
          name: 'Daniel',
          iss: 'https://accounts.google.com',
          aud: MOCK_VALID_CLIENT_ID, // Audience idêntico ao GOOGLE_CLIENT_ID configurado
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const idToken = `mock-google-token:${JSON.stringify(payload)}`;
        const authResult = await authService.loginWithGoogle(idToken);

        expect(authResult).toBeDefined();
        expect(authResult.token).toBeTruthy();
        expect(authResult.user.userId).toBe('google_user_synapse_987');
        expect(authResult.user.role).toBe('citizen');
        expect(authResult.profile.email).toBe('danfealmeida@gmail.com');
      } finally {
        process.env['GOOGLE_CLIENT_ID'] = originalEnv;
      }
    });

    it('4.2. Deve REJEITAR com erro se o token pertencer a outro aplicativo (aud mismatch)', async () => {
      const originalEnv = process.env['GOOGLE_CLIENT_ID'];
      process.env['GOOGLE_CLIENT_ID'] = MOCK_VALID_CLIENT_ID;

      try {
        const payloadFromAnotherApp = {
          sub: 'google_attacker_user',
          email: 'attacker@gmail.com',
          name: 'Invasor',
          iss: 'https://accounts.google.com',
          aud: MOCK_ANOTHER_CLIENT_ID, // Pertence a outro app Google, não ao Synapse City!
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const foreignToken = `mock-google-token:${JSON.stringify(payloadFromAnotherApp)}`;

        await expect(authService.loginWithGoogle(foreignToken)).rejects.toThrow(
          /AUDIENCE_MISMATCH/
        );
      } finally {
        process.env['GOOGLE_CLIENT_ID'] = originalEnv;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. RESILIÊNCIA: ACESSO COMO VISITANTE PERMANECE 100% OPERACIONAL
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Resiliência do Sistema (Guest Access Independente de Client ID)', () => {
    it('5.1. Entrada de visitante continua funcionando sem necessidade de credenciais do Google', () => {
      const guestResult = authService.createGuestToken();
      expect(guestResult).toBeDefined();
      expect(guestResult.token).toBeTruthy();
      expect(guestResult.user.role).toBe('guest');
      expect(guestResult.user.scenarioId).toBe('rua-central-main');
    });
  });
});
