// apps/web-client/src/services/api.ts
import type { AvatarCustomizationConfig } from '../avatars/daniel-avatar';

export interface AuthUser {
  userId: string;
  role: string;
  clientId?: string;
  scenarioId?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  avatarConfig?: AvatarCustomizationConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  profile?: UserProfile;
}

/**
 * Obtém a URL base da API HTTP do Synapse City.
 * Suporta acesso direto na porta 3001 e fallback para proxy reverso.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3001';
  const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
  return `http://${host}:3001`;
}

/**
 * Realiza fetch seguro com fallback automático entre API direta (porta 3001) e proxy relativo (/auth).
 */
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const primaryUrl = `${getApiBaseUrl()}${path}`;
  try {
    const res = await fetch(primaryUrl, options);
    if (res.ok || res.status < 500) {
      return res;
    }
  } catch {
    // Tenta fallback via proxy relativo
  }

  // Fallback para rota relativa via proxy do Vite
  return fetch(path, options);
}

/**
 * Cria ou recupera uma sessão de Convidado (Guest Access).
 */
export async function fetchGuestToken(): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await apiFetch('/auth/guest-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err: unknown) {
    throw new Error(`Falha ao obter token de visitante (Erro de rede: ${(err as Error)?.message || 'Servidor inacessível'})`);
  }

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.message) errorDetail = `${errJson.message} (HTTP ${res.status})`;
    } catch {
      // Ignora erro de parse
    }
    throw new Error(`Falha ao obter token de visitante (${errorDetail})`);
  }

  const data = await res.json();
  return {
    token: data.token,
    user: data.user,
    profile: {
      id: data.user?.userId || 'guest',
      displayName: 'Visitante',
    },
  };
}

/**
 * Obtém as configurações públicas de autenticação do backend (ex: Google Client ID).
 */
export async function fetchAuthConfig(): Promise<{ googleClientId: string }> {
  try {
    const res = await apiFetch('/auth/config');
    if (res.ok) {
      const data = await res.json();
      return { googleClientId: data.googleClientId || '' };
    }
  } catch {}
  return { googleClientId: '' };
}

/**
 * Realiza login via Google OIDC com suporte ao modo determinístico de desenvolvimento.
 */
export async function loginWithGoogle(email: string): Promise<AuthResponse> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error('Informe um endereço de e-mail válido.');
  }

  const namePart = cleanEmail.split('@')[0] || 'Usuário';
  const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  // Payload compatível com GoogleTokenPayload exigido pelo GoogleAuthService
  const payload = {
    sub: `google_${btoa(cleanEmail).replace(/=/g, '')}`,
    email: cleanEmail,
    email_verified: true,
    name: displayName,
    iss: 'https://accounts.google.com',
    aud: 'dev-google-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 horas de validade
  };

  const mockToken = `mock-google-token:${JSON.stringify(payload)}`;

  let res: Response;
  try {
    res = await apiFetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: mockToken }),
    });
  } catch (err: unknown) {
    throw new Error(`Falha no login com Google (Erro de rede: ${(err as Error)?.message || 'Servidor inacessível'})`);
  }

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.message) errorDetail = `${errJson.message} (HTTP ${res.status})`;
    } catch {
      // Ignora erro de parse
    }
    throw new Error(`Falha no login com Google (${errorDetail})`);
  }

  const data = await res.json();
  return {
    token: data.token,
    user: data.user,
    profile: data.profile,
  };
}

/**
 * Realiza login utilizando um id_token emitido pelo Google Identity Services (GIS Popup / One Tap Real).
 */
export async function loginWithGoogleIdToken(idToken: string): Promise<AuthResponse> {
  const cleanToken = idToken.trim();
  if (!cleanToken) {
    throw new Error('Token do Google inválido ou ausente.');
  }

  let res: Response;
  try {
    res = await apiFetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: cleanToken }),
    });
  } catch (err: unknown) {
    throw new Error(`Falha no login com Google (Erro de rede: ${(err as Error)?.message || 'Servidor inacessível'})`);
  }

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.message) errorDetail = `${errJson.message} (HTTP ${res.status})`;
    } catch {
      // Ignora erro de parse
    }
    throw new Error(`Falha na validação do login Google (${errorDetail})`);
  }

  const data = await res.json();
  return {
    token: data.token,
    user: data.user,
    profile: data.profile,
  };
}

/**
 * Salva a configuração de avatar persistente do usuário.
 */
export async function saveAvatarConfig(
  token: string,
  avatarConfig: AvatarCustomizationConfig,
): Promise<UserProfile> {
  const res = await apiFetch('/auth/profile/avatar', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ avatarConfig }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao salvar avatar: HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Obtém o perfil completo do usuário autenticado.
 */
export async function fetchUserProfile(token: string): Promise<UserProfile> {
  const res = await apiFetch('/auth/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Falha ao carregar perfil: HTTP ${res.status}`);
  }

  return res.json();
}
