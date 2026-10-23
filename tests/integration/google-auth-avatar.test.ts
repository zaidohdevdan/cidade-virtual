// tests/integration/google-auth-avatar.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabaseConnection, MarketplaceRepository } from '@cidade-virtual/persistence';
import { AuthService, DEFAULT_AVATAR_CONFIG } from '../../apps/api/src/auth/auth.service';
import { GoogleAuthService } from '../../apps/api/src/auth/google-auth.service';

describe('Task-043 — Google Login (OIDC) & Avatar Selection Persistence', () => {
  let dbConnection: ReturnType<typeof createDatabaseConnection>;
  let marketplaceRepo: MarketplaceRepository;
  let googleAuthService: GoogleAuthService;
  let authService: AuthService;

  beforeAll(async () => {
    dbConnection = createDatabaseConnection();
    marketplaceRepo = new MarketplaceRepository(dbConnection.db);
    googleAuthService = new GoogleAuthService();
    authService = new AuthService(googleAuthService, marketplaceRepo);
  });

  afterAll(async () => {
    await dbConnection.pool.end();
  });

  it('1. Deve rejeitar idToken ausente ou malformado', async () => {
    await expect(authService.loginWithGoogle('')).rejects.toThrow();
    await expect(authService.loginWithGoogle('not-a-token')).rejects.toThrow();
  });

  it('2. Deve rejeitar token com audience errada quando GOOGLE_CLIENT_ID configurado', async () => {
    const originalClientId = process.env['GOOGLE_CLIENT_ID'];
    process.env['GOOGLE_CLIENT_ID'] = 'expected-app-client-id';

    try {
      const payload = {
        sub: 'google-sub-attacker-123',
        email: 'attacker@gmail.com',
        aud: 'foreign-app-id', // Audience errada
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const badAudienceToken = `mock-google-token:${JSON.stringify(payload)}`;

      await expect(authService.loginWithGoogle(badAudienceToken)).rejects.toThrow(/AUDIENCE_MISMATCH/);
    } finally {
      if (originalClientId !== undefined) {
        process.env['GOOGLE_CLIENT_ID'] = originalClientId;
      } else {
        delete process.env['GOOGLE_CLIENT_ID'];
      }
    }
  });

  it('3. Deve rejeitar token Google com data de expiração no passado', async () => {
    const payload = {
      sub: 'google-sub-expired-123',
      email: 'expired@gmail.com',
      aud: 'app-client-id',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) - 100, // Expirado há 100s
    };
    const expiredToken = `mock-google-token:${JSON.stringify(payload)}`;

    await expect(authService.loginWithGoogle(expiredToken)).rejects.toThrow(/TOKEN_EXPIRED/);
  });

  it('4. Deve rejeitar emissor diferente do Google', async () => {
    const payload = {
      sub: 'google-sub-fake-iss',
      email: 'fake@evil.com',
      aud: 'app-client-id',
      iss: 'https://evil-issuer.com', // Emissor falso
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const badIssuerToken = `mock-google-token:${JSON.stringify(payload)}`;

    await expect(authService.loginWithGoogle(badIssuerToken)).rejects.toThrow(/INVALID_ISSUER/);
  });

  it('5. Usuário novo: login Google cria perfil no PostgreSQL com avatar padrão e emite JWT de cidadão', async () => {
    const uniqueSub = `sub_test_user_${Date.now()}`;
    const payload = {
      sub: uniqueSub,
      email: `${uniqueSub}@gmail.com`,
      name: 'Maria Exploradora',
      aud: 'app-client-id',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = `mock-google-token:${JSON.stringify(payload)}`;

    const loginResult = await authService.loginWithGoogle(token);

    expect(loginResult).toBeDefined();
    expect(loginResult.token).toBeDefined();
    expect(loginResult.user.userId).toBe(uniqueSub);
    expect(loginResult.user.role).toBe('citizen');
    expect(loginResult.profile.id).toBe(uniqueSub);
    expect(loginResult.profile.email).toBe(`${uniqueSub}@gmail.com`);
    expect(loginResult.profile.displayName).toBe('Maria Exploradora');
    expect(loginResult.profile.avatarConfig).toEqual(DEFAULT_AVATAR_CONFIG);

    // Valida que o token JWT emitido é decodificável pelo próprio AuthService
    const validated = authService.validateToken(loginResult.token);
    expect(validated.userId).toBe(uniqueSub);
    expect(validated.role).toBe('citizen');
  });

  it('6. Usuário customiza avatar e a escolha persiste no PostgreSQL', async () => {
    const uniqueSub = `sub_customizer_${Date.now()}`;
    const payload = {
      sub: uniqueSub,
      email: `${uniqueSub}@gmail.com`,
      name: 'Carlos Customizador',
      aud: 'app-client-id',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = `mock-google-token:${JSON.stringify(payload)}`;
    await authService.loginWithGoogle(token);

    // Nova configuração personalizada com as cores da Petz
    const customAvatarConfig = {
      model: 'urban_runner',
      primaryColor: '#004CBF', // Azul Petz
      secondaryColor: '#FFD000', // Amarelo Petz
      skinTone: '#8d5524',
      hairColor: '#241c18',
      accessories: ['glasses'],
    };

    const updatedProfile = await authService.updateAvatarConfig(uniqueSub, customAvatarConfig);
    expect(updatedProfile.avatarConfig).toEqual(customAvatarConfig);

    // Consulta perfil do banco e verifica persistência real
    const loadedProfile = await authService.getUserProfile(uniqueSub);
    expect(loadedProfile.avatarConfig).toEqual(customAvatarConfig);
  });

  it('7. Ao voltar e relogar com a mesma conta Google, o avatar customizado é preservado', async () => {
    const uniqueSub = `sub_returning_${Date.now()}`;
    const payload = {
      sub: uniqueSub,
      email: `${uniqueSub}@gmail.com`,
      name: 'Ana Retornante',
      aud: 'app-client-id',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = `mock-google-token:${JSON.stringify(payload)}`;

    // 1º login
    await authService.loginWithGoogle(token);

    // Customiza avatar
    const customConfig = {
      model: 'casual_male_1',
      primaryColor: '#FF7A00', // Laranja Petz
      secondaryColor: '#1E293B',
      skinTone: '#ffd1aa',
      hairColor: '#9a6b43',
      accessories: [],
    };
    await authService.updateAvatarConfig(uniqueSub, customConfig);

    // 2º login (usuário volta após um tempo)
    const secondLoginResult = await authService.loginWithGoogle(token);

    // O avatar carregado deve ser exatamente o customizado, nunca o padrão resetado
    expect(secondLoginResult.profile.avatarConfig).toEqual(customConfig);
  });

  it('8. Deve rejeitar configuração de avatar inválida (segurança contra injection)', async () => {
    const uniqueSub = `sub_injection_test_${Date.now()}`;

    // Cor malformada
    await expect(
      authService.updateAvatarConfig(uniqueSub, {
        model: 'casual_male_1',
        primaryColor: 'javascript:alert(1)', // Tentativa de injeção
      })
    ).rejects.toThrow(/Configuração de avatar inválida/);

    // Model com caracteres perigosos
    await expect(
      authService.updateAvatarConfig(uniqueSub, {
        model: '<script>bad()</script>',
        primaryColor: '#004CBF',
        secondaryColor: '#FFD000',
      })
    ).rejects.toThrow(/Configuração de avatar inválida/);
  });
});
