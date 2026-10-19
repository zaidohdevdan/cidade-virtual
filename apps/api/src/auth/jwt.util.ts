// apps/api/src/auth/jwt.util.ts
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { AuthPrincipal } from './auth.types';

let cachedEphemeralSecret: string | null = null;

/**
 * Resolução de Segredo Criptográfico Multi-Tiered (mandatory-secure-web-skills):
 * 1. process.env.JWT_SECRET (se fornecido)
 * 2. Fallback de secret criptográfico aleatório de 256 bits gerado pelo OS CSPRNG
 *    com log de alerta severo de isolamento por instância.
 */
export function getJwtSecret(): string {
  if (process.env['JWT_SECRET'] && process.env['JWT_SECRET'].trim().length > 0) {
    return process.env['JWT_SECRET'].trim();
  }

  if (!cachedEphemeralSecret) {
    cachedEphemeralSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[SECURITY] [WARN] Ephemeral secret generated. Instance-isolated! Configure JWT_SECRET in production.',
    );
  }
  return cachedEphemeralSecret;
}

/**
 * Emite token JWT assinado exclusivamente com algoritmo HS256 e expiração compulsória.
 */
export function signJwtToken(
  payload: AuthPrincipal,
  expiresIn: jwt.SignOptions['expiresIn'] = '24h',
): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
  });
}

/**
 * Validação rigorosa de token JWT.
 * - Rejeita algoritmo 'none'
 * - Força algoritmo esperado ['HS256']
 * - Valida claim 'exp'
 */
export function verifyJwtToken(token: string): AuthPrincipal {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  });

  if (
    typeof decoded !== 'object' ||
    !decoded ||
    !('userId' in decoded) ||
    !('role' in decoded)
  ) {
    throw new Error('INVALID_TOKEN_PAYLOAD: Token não contém os campos do Principal');
  }

  return {
    userId: (decoded as any).userId,
    role: (decoded as any).role,
    clientId: (decoded as any).clientId,
    scenarioId: (decoded as any).scenarioId,
  };
}

/**
 * Reseta o segredo temporário (usado estritamente em testes).
 */
export function _resetEphemeralSecretForTesting(): void {
  cachedEphemeralSecret = null;
}
