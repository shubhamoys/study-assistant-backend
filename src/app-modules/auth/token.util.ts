import { randomBytes, createHash } from 'crypto';

/**
 * Every opaque token this app hands to a client (refresh token, email
 * verification token, password reset token) is generated the same way: a
 * random raw value sent to the client/email, with only its SHA-256 hash ever
 * persisted. SHA-256 (not bcrypt) is deliberate — these tokens are already
 * high-entropy random values, not user-chosen secrets, so there's no
 * offline-guessing risk to defend against with a slow hash; a fast
 * deterministic hash is what lets lookup-by-token stay a plain indexed
 * equality query instead of iterating every row to bcrypt-compare each one.
 */
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
