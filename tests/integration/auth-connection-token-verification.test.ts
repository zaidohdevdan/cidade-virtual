// tests/integration/auth-connection-token-verification.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createDatabaseConnection, MarketplaceRepository } from '@cidade-virtual/persistence';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { GoogleAuthService } from '../../apps/api/src/auth/google-auth.service';
import { fetchGuestToken, loginWithGoogle } from '../../apps/web-client/src/services/api';

describe('Verificação de Conexão, Validação de Token e Chamada à API do Google', () => {
  let dbConnection: ReturnType<typeof createDatabaseConnection>;
  let marketplaceRepo: MarketplaceRepository;
  let googleAuthService: GoogleAuthService;
  let authService: AuthService;

  const TEST_CLIENT_ID = 'dev-google-client-id';
  let previousClientId: string | undefined;

  beforeAll(async () => {
    previousClientId = process.env['GOOGLE_CLIENT_ID'];
    process.env['GOOGLE_CLIENT_ID'] = TEST_CLIENT_ID;
    dbConnection = createDatabaseConnection();
    marketplaceRepo = new MarketplaceRepository(dbConnection.db);
    googleAuthService = new GoogleAuthService();
    authService = new AuthService(googleAuthService, marketplaceRepo);
  });

  afterAll(async () => {
    if (previousClientId !== undefined) {
      process.env['GOOGLE_CLIENT_ID'] = previousClientId;
    } else {
      delete process.env['GOOGLE_CLIENT_ID'];
    }
    await dbConnection.pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. VERIFICAÇÃO DE PROBLEMAS DE CONEXÃO AO LOGAR
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Problemas de Conexão ao Logar (Connection Resilience & Error Handling)', () => {
    it('1.1. Deve tratar falha de rede física (ECONNREFUSED / Offline) sem crash e retornar mensagem clara', async () => {
      // Simula fetch falhando com erro de conexão em todas as rotas (porta 3001 e proxy offline)
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch: Connection refused (ECONNREFUSED)'));

      await expect(loginWithGoogle('danfealmeida@gmail.com')).rejects.toThrow(/Falha no login com Google/);
      await expect(fetchGuestToken()).rejects.toThrow(/Falha ao obter token de visitante/);
    });

    it('1.2. Deve identificar e relatar erro HTTP 404 (Endpoint ausente / Falha de roteamento de proxy)', async () => {
      // Simula o erro exato que ocorria antes da configuração de proxy (HTTP 404)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Cannot POST /auth/google', statusCode: 404 }),
      });

      await expect(loginWithGoogle('danfealmeida@gmail.com')).rejects.toThrow(/HTTP 404/);
    });

    it('1.3. Deve tratar erro HTTP 500/503 (Servidor em falha) e extrair a mensagem de erro do backend', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ message: 'Serviço de autenticação temporariamente indisponível' }),
      });

      await expect(loginWithGoogle('danfealmeida@gmail.com')).rejects.toThrow(
        /Serviço de autenticação temporariamente indisponível/
      );
    });

    it('1.4. Fallback de resiliência: se acesso direto à porta 3001 falha, deve tentar a rota de proxy com sucesso', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        // Primeira chamada (direta na porta 3001): simula falha de conexão de rede
        if (url.includes(':3001')) {
          return Promise.reject(new Error('Network error on direct port'));
        }
        // Segunda chamada (fallback relativo via proxy do Vite): sucesso
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            token: 'jwt-fallback-success',
            user: { userId: 'guest_fallback_1', role: 'guest' },
          }),
        });
      });

      const result = await fetchGuestToken();
      expect(callCount).toBe(2); // Validou que tentou a porta direta e fez fallback para proxy
      expect(result.token).toBe('jwt-fallback-success');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SE O LOGIN PASSOU POR VERIFICAÇÃO DE TOKEN
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Verificação Rigorosa de Token (Token Verification & JWT Issuance)', () => {
    it('2.1. Deve rejeitar token nulo, vazio ou com espaços em branco', async () => {
      await expect(authService.loginWithGoogle('')).rejects.toThrow(/idToken é obrigatório/);
      await expect(authService.loginWithGoogle('   ')).rejects.toThrow(/idToken é obrigatório/);
    });

    it('2.2. Deve verificar a expiração do token e rejeitar tokens expirados', async () => {
      const expiredPayload = {
        sub: 'google_user_expired',
        email: 'expired@gmail.com',
        iss: 'https://accounts.google.com',
        aud: 'dev-google-client-id',
        exp: Math.floor(Date.now() / 1000) - 60, // Expirado há 1 minuto
      };
      const token = `mock-google-token:${JSON.stringify(expiredPayload)}`;

      await expect(authService.loginWithGoogle(token)).rejects.toThrow(/TOKEN_EXPIRED/);
    });

    it('2.3. Deve verificar o emissor (iss) e rejeitar emissores não autorizados', async () => {
      const badIssuerPayload = {
        sub: 'google_user_bad_iss',
        email: 'hacker@evil.org',
        iss: 'https://evil-identity-provider.com',
        aud: 'dev-google-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = `mock-google-token:${JSON.stringify(badIssuerPayload)}`;

      await expect(authService.loginWithGoogle(token)).rejects.toThrow(/INVALID_ISSUER/);
    });

    it('2.4. Deve verificar o Audience (aud) e rejeitar tokens de outras aplicações', async () => {
      const originalEnv = process.env['GOOGLE_CLIENT_ID'];
      process.env['GOOGLE_CLIENT_ID'] = 'synapse-city-official-app';

      try {
        const foreignAudPayload = {
          sub: 'google_user_foreign',
          email: 'user@gmail.com',
          iss: 'https://accounts.google.com',
          aud: 'different-app-id', // Token emitido para outro app
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
        const token = `mock-google-token:${JSON.stringify(foreignAudPayload)}`;

        await expect(authService.loginWithGoogle(token)).rejects.toThrow(/AUDIENCE_MISMATCH/);
      } finally {
        if (originalEnv) {
          process.env['GOOGLE_CLIENT_ID'] = originalEnv;
        } else {
          delete process.env['GOOGLE_CLIENT_ID'];
        }
      }
    });

    it('2.5. Deve rejeitar token sem o claim obrigatório sub', async () => {
      const noSubPayload = {
        email: 'user@gmail.com',
        iss: 'https://accounts.google.com',
        aud: 'dev-google-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = `mock-google-token:${JSON.stringify(noSubPayload)}`;

      await expect(authService.loginWithGoogle(token)).rejects.toThrow(/ausência do claim sub/);
    });

    it('2.6. Token válido aprovado na verificação: deve gerar JWT assinado com claims e perfil persistente', async () => {
      const validSub = `google_verified_${Date.now()}`;
      const validPayload = {
        sub: validSub,
        email: 'danfealmeida@gmail.com',
        name: 'Daniel Almeida',
        iss: 'https://accounts.google.com',
        aud: 'dev-google-client-id',
        exp: Math.floor(Date.now() / 1000) + 7200,
      };
      const token = `mock-google-token:${JSON.stringify(validPayload)}`;

      const authResult = await authService.loginWithGoogle(token);

      // Valida que passou pela verificação e gerou JWT seguro
      expect(authResult.token).toBeDefined();
      expect(typeof authResult.token).toBe('string');
      expect(authResult.user.userId).toBe(validSub);
      expect(authResult.user.role).toBe('citizen');
      expect(authResult.profile.displayName).toBe('Daniel Almeida');
      expect(authResult.profile.email).toBe('danfealmeida@gmail.com');

      // Valida que o token JWT emitido é decodificável e reconhecido pelo AuthService
      const validatedPrincipal = authService.validateToken(authResult.token);
      expect(validatedPrincipal.userId).toBe(validSub);
      expect(validatedPrincipal.role).toBe('citizen');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SE A API DO GOOGLE FOI CHAMADA
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Verificação de Chamada à API Oficial do Google (Google OIDC Provider Dispatch)', () => {
    let originalNodeEnv: string | undefined;
    let originalMockEnv: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env['NODE_ENV'];
      originalMockEnv = process.env['GOOGLE_AUTH_MOCK'];
      // Ativa modo live/produção para desarmar o bypass de mock e forçar a chamada HTTP oficial
      process.env['NODE_ENV'] = 'production';
      process.env['GOOGLE_AUTH_MOCK'] = 'false';
    });

    afterAll(() => {
      if (originalNodeEnv !== undefined) {
        process.env['NODE_ENV'] = originalNodeEnv;
      } else {
        delete process.env['NODE_ENV'];
      }
      if (originalMockEnv !== undefined) {
        process.env['GOOGLE_AUTH_MOCK'] = originalMockEnv;
      } else {
        delete process.env['GOOGLE_AUTH_MOCK'];
      }
    });

    it('3.1. Deve disparar requisição HTTP GET para https://oauth2.googleapis.com/tokeninfo em tokens de produção', async () => {
      const productionRealToken = 'google_live_jwt_token_header_payload_signature';
      let calledUrl = '';
      let calledMethod = '';

      // Intercepta e valida a chamada de rede despachada para a API oficial do Google
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        calledUrl = url;
        calledMethod = init?.method || 'GET';

        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            sub: 'google_prod_user_789',
            email: 'danfealmeida@gmail.com',
            email_verified: 'true',
            name: 'Daniel Almeida Real',
            aud: 'dev-google-client-id',
            iss: 'https://accounts.google.com',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        });
      });

      const liveGoogleAuthService = new GoogleAuthService();
      const liveAuthService = new AuthService(liveGoogleAuthService, marketplaceRepo);

      // Executa login com o token oficial do Google
      const result = await liveAuthService.loginWithGoogle(productionRealToken);

      // ── VERIFICAÇÃO 1: A API do Google foi chamada via HTTP? ──
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      // ── VERIFICAÇÃO 2: O método HTTP foi GET? ──
      expect(calledMethod).toBe('GET');
      // ── VERIFICAÇÃO 3: O endpoint chamado é o endpoint oficial tokeninfo do Google? ──
      expect(calledUrl).toContain('https://oauth2.googleapis.com/tokeninfo');
      // ── VERIFICAÇÃO 4: O token foi codificado na query string? ──
      expect(calledUrl).toContain(`id_token=${encodeURIComponent(productionRealToken)}`);

      // ── VERIFICAÇÃO 5: Os dados retornados pelo Google autenticam o cidadão com sucesso ──
      expect(result.user.userId).toBe('google_prod_user_789');
      expect(result.profile.displayName).toBe('Daniel Almeida Real');
      expect(result.profile.email).toBe('danfealmeida@gmail.com');
    });

    it('3.2. Quando a API do Google retorna erro (Token revogado ou rejeitado pelo Google), deve lançar UnauthorizedException', async () => {
      const invalidToken = 'revoked_or_tampered_google_token';

      // Simula a API do Google respondendo 400 Bad Request
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error_description: 'Invalid Value' }),
      });

      const liveGoogleAuthService = new GoogleAuthService();
      const liveAuthService = new AuthService(liveGoogleAuthService, marketplaceRepo);

      await expect(liveAuthService.loginWithGoogle(invalidToken)).rejects.toThrow(
        /Token Google inválido ou rejeitado pelo provedor/
      );
      // Confirma que a API do Google foi consultada antes de rejeitar o login
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('3.3. Quando a chamada para a API do Google falha por timeout ou queda de conexão, deve tratar graciosamente', async () => {
      const realToken = 'google_token_timeout_test';

      // Simula timeout da conexão com a API do Google
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout connecting to oauth2.googleapis.com'));

      const liveGoogleAuthService = new GoogleAuthService();
      const liveAuthService = new AuthService(liveGoogleAuthService, marketplaceRepo);

      await expect(liveAuthService.loginWithGoogle(realToken)).rejects.toThrow(
        /Falha ao autenticar com o Google OIDC/
      );
      // Confirma que o serviço tentou contatar a API do Google
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('3.4. [SECURITY] Deve REJEITAR sumariamente qualquer tentativa de token forjado/mock fora do ambiente de teste', async () => {
      const forgedMockToken = 'mock-google-token:{"sub":"attacker_123","email":"ceo@empresa.com","aud":"synapse-city-official-app","iss":"https://accounts.google.com","exp":9999999999}';

      globalThis.fetch = vi.fn();
      const liveGoogleAuthService = new GoogleAuthService();
      const liveAuthService = new AuthService(liveGoogleAuthService, marketplaceRepo);

      await expect(liveAuthService.loginWithGoogle(forgedMockToken)).rejects.toThrow(
        /Tokens de teste\/mock não são permitidos neste ambiente/
      );

      // Garante que nem tentou contatar a API nem emitiu sessão
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
