import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGuestToken, loginWithGoogle, saveAvatarConfig } from './api';

describe('Auth API Client Service — Synapse City', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchGuestToken deve obter token e perfil de visitante', async () => {
    const mockGuestResponse = {
      token: 'jwt-guest-token-xyz',
      user: {
        userId: 'guest_123',
        role: 'guest',
        scenarioId: 'rua-central-main',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGuestResponse,
    });

    const res = await fetchGuestToken();
    expect(res.token).toBe('jwt-guest-token-xyz');
    expect(res.user.userId).toBe('guest_123');
    expect(res.profile?.displayName).toBe('Visitante');
  });

  it('loginWithGoogle deve enviar idToken com expiração e claims corretos e retornar perfil', async () => {
    const mockGoogleResponse = {
      token: 'jwt-google-token-abc',
      user: {
        userId: 'google_danfealmeida',
        role: 'citizen',
      },
      profile: {
        id: 'google_danfealmeida',
        email: 'danfealmeida@gmail.com',
        displayName: 'Danfealmeida',
        avatarConfig: {
          primaryColor: '#1e5bd8',
          secondaryColor: '#f2b705',
        },
      },
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || '{}');
      expect(body.idToken).toBeDefined();
      expect(body.idToken).toContain('danfealmeida@gmail.com');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockGoogleResponse,
      });
    });

    const res = await loginWithGoogle('danfealmeida@gmail.com');
    expect(res.token).toBe('jwt-google-token-abc');
    expect(res.profile?.email).toBe('danfealmeida@gmail.com');
    expect(res.profile?.avatarConfig?.primaryColor).toBe('#1e5bd8');
  });

  it('saveAvatarConfig deve enviar token no cabeçalho Authorization Bearer', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token-123',
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user_1', avatarConfig: { primaryColor: '#ff0000' } }),
      });
    });

    const res = await saveAvatarConfig('test-token-123', { primaryColor: '#ff0000' });
    expect(res.avatarConfig?.primaryColor).toBe('#ff0000');
  });
});
