import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { AdminPermissions, MembershipRole, MembershipStatus, SocietyMembership, User } from '@/types';
import {
  SESSION_COOKIE,
  SOCIETY_COOKIE,
  isDevAuthEnabled,
  verifySessionCookieValue,
} from '@/lib/auth/session';

export interface AuthContext {
  userId: string;
  /** Firebase Auth UID behind the session (equals userId for dev identities) */
  authUid: string;
  societyId: string;
  role: MembershipRole;
  status: MembershipStatus;
  permissions?: AdminPermissions;
}

// Membership statuses allowed to use onboarding routes (profile, vehicles)
export const ONBOARDING_STATUSES: MembershipStatus[] = ['ACTIVE', 'PENDING_APPROVAL', 'REGISTERED'];

/**
 * Resolves the signed-in user from the session cookie.
 *
 * Priority order:
 * 1. `junto_session` cookie (Firebase session cookie; `dev:<id>` outside production)
 * 2. Outside production only: `x-dev-user-id` header, then the default demo persona
 */
export async function getSessionUser(
  req: NextRequest
): Promise<{ user: User; authUid: string } | null> {
  // Read the request before touching the repository so build-time
  // prerendering of GET routes stops here instead of opening a database
  const identity = await verifySessionCookieValue(req.cookies.get(SESSION_COOKIE)?.value);
  let authUid = identity?.uid;

  if (!authUid && isDevAuthEnabled()) {
    authUid = req.headers.get('x-dev-user-id') || 'usr-offerer-001';
  }
  if (!authUid) return null;

  const repo = getRepository();
  const user = (await repo.getUserById(authUid)) ?? (await repo.getUserByFirebaseUid(authUid));
  // A deleted account can never be used again
  if (!user || user.deletedAt) return null;

  return { user, authUid };
}

// Order in which a user's societies are picked when none is selected
const STATUS_PREFERENCE: MembershipStatus[] = [
  'ACTIVE',
  'PENDING_APPROVAL',
  'REGISTERED',
  'INVITED',
  'SUSPENDED',
  'REJECTED',
  'DEACTIVATED',
];

/**
 * The membership to use when the user hasn't picked a society (or picked one
 * they don't belong to): their active one first, then pending ones.
 */
export function preferredMembership(memberships: SocietyMembership[]): SocietyMembership | null {
  return (
    [...memberships].sort(
      (a, b) => STATUS_PREFERENCE.indexOf(a.status) - STATUS_PREFERENCE.indexOf(b.status)
    )[0] ?? null
  );
}

/**
 * Validates the session and resolves the membership in the selected society
 * (`x-society-id` header, else the `junto_society_id` cookie), falling back to
 * the user's own preferred membership. Returns null if the user is not signed
 * in or belongs to no society.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const session = await getSessionUser(req);
  if (!session) return null;

  const repo = getRepository();
  const requestedSocietyId = req.headers.get('x-society-id') || req.cookies.get(SOCIETY_COOKIE)?.value;

  const membership =
    (requestedSocietyId ? await repo.getMembership(requestedSocietyId, session.user.id) : null) ??
    preferredMembership(await repo.listUserMemberships(session.user.id));
  if (!membership) return null;

  return {
    userId: session.user.id,
    authUid: session.authUid,
    societyId: membership.societyId,
    role: membership.role,
    status: membership.status,
    permissions: membership.permissions,
  };
}

interface RequireAuthOptions {
  /** Membership statuses allowed through; defaults to ACTIVE only */
  statuses?: MembershipStatus[];
  /** Roles allowed through; defaults to any role */
  roles?: MembershipRole[];
  /**
   * Admin permission required. SUPER_ADMIN always passes; a SOCIETY_ADMIN
   * passes unless that permission has been explicitly turned off. Implies
   * an admin role.
   */
  permission?: keyof AdminPermissions;
}

export const ADMIN_ROLES: MembershipRole[] = ['SOCIETY_ADMIN', 'SUPER_ADMIN'];

export function hasAdminPermission(auth: AuthContext, permission: keyof AdminPermissions): boolean {
  if (auth.role === 'SUPER_ADMIN') return true;
  if (auth.role !== 'SOCIETY_ADMIN') return false;
  return auth.permissions?.[permission] !== false;
}

/**
 * Route guard. Returns the auth context, or an error response to return as-is:
 * 401 when signed out, 403 when the membership status or role is not allowed.
 *
 *   const auth = await requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireAuth(
  req: NextRequest,
  options: RequireAuthOptions = {}
): Promise<AuthContext | NextResponse> {
  const { statuses = ['ACTIVE'], roles, permission } = options;

  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);
  if (!statuses.includes(auth.status)) return errorResponse('Membership not active', 403);
  if (roles && !roles.includes(auth.role)) return errorResponse('Forbidden', 403);
  if (permission && !hasAdminPermission(auth, permission)) return errorResponse('Forbidden', 403);

  return auth;
}

/**
 * Standard API error responder
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Logs the real error server-side and returns a generic 500, so internal
 * details never reach the client.
 */
export function serverError(context: string, err: unknown) {
  console.error(`${context}:`, err);
  return errorResponse('Something went wrong. Please try again.', 500);
}
