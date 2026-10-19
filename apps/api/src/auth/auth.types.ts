// apps/api/src/auth/auth.types.ts

export type UserRole = 'admin' | 'citizen' | 'guest' | 'agent';

export interface AuthPrincipal {
  userId: string;
  role: UserRole;
  clientId?: string;
  scenarioId?: string;
}
