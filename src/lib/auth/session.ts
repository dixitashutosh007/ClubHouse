import { adminAuth } from '@/lib/firebase/admin';

/**
 * Session handling backed by Firebase session cookies.
 *
 * Production: the cookie is a Firebase-signed session cookie created from a
 * freshly verified ID token, and every request verifies it (including a
 * revocation check).
 *
 * Development and tests only: a `dev:<userId>` cookie is accepted so the app
 * can run against the seeded mock repository without Firebase.
 */

export const SESSION_COOKIE = 'junto_session';
export const SOCIETY_COOKIE = 'junto_society_id';

// Cookies from before signed sessions; cleared on login and logout
export const LEGACY_COOKIES = ['societyapps_session', 'societyapps_society_id'];

// Firebase allows session cookies of at most 14 days
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

// Only exchange ID tokens from a sign-in that happened in the last 5 minutes
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

const DEV_COOKIE_PREFIX = 'dev:';
const DEV_TOKEN_PREFIX = 'dev-token-';

export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export interface VerifiedIdentity {
  /** Firebase Auth UID (or the user ID itself for dev identities) */
  uid: string;
  phoneNumber?: string;
}

/**
 * Verifies a recently issued Firebase ID token.
 *
 * `freshness` picks the claim that must be under 5 minutes old:
 * - `auth_time` (default): the user completed an SMS sign-in just now
 * - `iat`: the token was just refreshed, e.g. after updatePhoneNumber()
 *
 * In development, `dev-token-<userId>` is accepted in place of a real token.
 */
export async function verifyFreshIdToken(
  idToken: string,
  freshness: 'auth_time' | 'iat' = 'auth_time'
): Promise<VerifiedIdentity | null> {
  if (isDevAuthEnabled() && idToken.startsWith(DEV_TOKEN_PREFIX)) {
    return { uid: idToken.slice(DEV_TOKEN_PREFIX.length) };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const ageSeconds = Date.now() / 1000 - decoded[freshness];
    if (ageSeconds > MAX_SIGN_IN_AGE_SECONDS) return null;
    return { uid: decoded.uid, phoneNumber: decoded.phone_number };
  } catch (err) {
    console.warn('ID token verification failed', err);
    return null;
  }
}

/**
 * Creates the session cookie value for a verified identity.
 * Must be called with the same ID token that was just verified.
 */
export async function createSessionCookieValue(
  idToken: string,
  identity: VerifiedIdentity
): Promise<string> {
  if (isDevAuthEnabled() && idToken.startsWith(DEV_TOKEN_PREFIX)) {
    return `${DEV_COOKIE_PREFIX}${identity.uid}`;
  }
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

/**
 * Verifies a session cookie value. Returns null for missing, forged,
 * expired or revoked sessions.
 */
export async function verifySessionCookieValue(
  cookieValue: string | undefined
): Promise<VerifiedIdentity | null> {
  if (!cookieValue) return null;

  if (cookieValue.startsWith(DEV_COOKIE_PREFIX)) {
    if (!isDevAuthEnabled()) return null;
    return { uid: cookieValue.slice(DEV_COOKIE_PREFIX.length) };
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);
    return { uid: decoded.uid, phoneNumber: decoded.phone_number };
  } catch {
    return null;
  }
}

/**
 * Revokes all Firebase refresh tokens for the user, which also invalidates
 * every session cookie issued to them. No-op for dev identities.
 */
export async function revokeSessions(cookieValue: string | undefined): Promise<void> {
  const identity = await verifySessionCookieValue(cookieValue);
  if (!identity || cookieValue?.startsWith(DEV_COOKIE_PREFIX)) return;
  try {
    await adminAuth.revokeRefreshTokens(identity.uid);
  } catch (err) {
    console.warn('Failed to revoke refresh tokens on logout', err);
  }
}

/**
 * Removes the Firebase sign-in account after a resident deletes their Club
 * House account, so signing in again starts afresh. Best effort.
 */
export async function deleteSignInAccount(uid: string): Promise<void> {
  if (isDevAuthEnabled()) return;
  try {
    await adminAuth.revokeRefreshTokens(uid);
    await adminAuth.deleteUser(uid);
  } catch (err) {
    console.warn('Failed to delete the Firebase sign-in account', err);
  }
}
