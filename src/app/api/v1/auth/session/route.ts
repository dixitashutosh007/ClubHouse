import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, preferredMembership } from '@/lib/api-auth';
import {
  LEGACY_COOKIES,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SOCIETY_COOKIE,
  createSessionCookieValue,
  isDevAuthEnabled,
  revokeSessions,
  verifyFreshIdToken,
} from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { CreateSessionSchema } from '@/lib/validation/schemas';
import { Society, SocietySummary, User } from '@/types';
import { activateSocietyForAdmin, findSocietiesAwaitingAdmin } from '@/lib/services/society-onboarding';

/**
 * Exchanges a Firebase ID token from a fresh phone OTP sign-in for a
 * Firebase session cookie, creating the user and a pending membership on
 * first sign-in.
 */
export async function POST(req: NextRequest) {
  const limit = await rateLimit(`session:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const parsed = CreateSessionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse('Missing idToken');
  const { idToken, societyCode, societyId } = parsed.data;

  const identity = await verifyFreshIdToken(idToken);
  if (!identity) return errorResponse('Invalid or expired sign-in. Please verify your mobile again.', 401);
  if (!identity.phoneNumber && !isDevAuthEnabled()) {
    return errorResponse('Mobile number sign-in required', 401);
  }

  try {
    const repo = getRepository();

    // Joining by invite link names the society; otherwise use an existing membership
    const joining = Boolean(societyCode || societyId);
    const invitedSociety = societyCode
      ? await repo.getSocietyByCode(societyCode)
      : societyId
        ? await repo.getSocietyById(societyId)
        : null;
    if (joining && (!invitedSociety || invitedSociety.status !== 'ACTIVE')) {
      return errorResponse('Invalid or inactive society invitation code', 404);
    }

    // Resolve the user: by Firebase UID first, then by verified phone number
    let user: User | null =
      (await repo.getUserById(identity.uid)) ?? (await repo.getUserByFirebaseUid(identity.uid));

    if (!user && identity.phoneNumber) {
      const byPhone = await repo.getUserByPhone(identity.phoneNumber);
      if (byPhone) {
        if (byPhone.firebaseUid && byPhone.firebaseUid !== identity.uid) {
          // The stored number is already linked to another sign-in account
          return errorResponse(
            'This mobile number is linked to another account. Please contact your society admin.',
            409
          );
        }
        user = await repo.updateUser(byPhone.id, { firebaseUid: identity.uid });
      }
    }

    // A society being set up names this number as its admin: signing in with it (OTP) verifies them
    const adminPhone = identity.phoneNumber ?? (isDevAuthEnabled() ? user?.mobile : undefined);
    const awaitingAdmin = joining ? [] : await findSocietiesAwaitingAdmin(repo, adminPhone);

    const existingMembership = user && !invitedSociety
      ? preferredMembership(await repo.listUserMemberships(user.id))
      : null;
    if (!invitedSociety && !existingMembership && awaitingAdmin.length === 0) {
      // The sign-in screen offers a society search next (or the invite link)
      return NextResponse.json(
        {
          error: "This number isn't registered with a society yet. Find your society to request to join.",
          needsSociety: true,
        },
        { status: 404 }
      );
    }
    if (!user) {
      // Initial user stub awaiting resident onboarding
      const phoneNumber = identity.phoneNumber ?? '';
      user = await repo.createUser({
        id: identity.uid,
        firebaseUid: identity.uid,
        cognitoSub: `fb-${identity.uid}`,
        email: `${phoneNumber.replace(/\D/g, '')}@societyapps.org`,
        mobile: phoneNumber,
        fullName: 'Resident Member',
        gender: 'PREFER_NOT_TO_SAY',
        profileCompleted: false,
        createdAt: new Date().toISOString(),
      });
    }

    let activated: Society | null = null;
    for (const pending of awaitingAdmin) {
      const live = await activateSocietyForAdmin(repo, pending, user);
      activated ??= live;
    }

    const society =
      invitedSociety ?? activated ?? (existingMembership ? await repo.getSocietyById(existingMembership.societyId) : null);
    if (!society) return errorResponse('Society not found', 404);

    let membership = await repo.getMembership(society.id, user.id);
    if (!membership) {
      const now = new Date().toISOString();
      membership = await repo.createMembership({
        id: `mem-${crypto.randomUUID()}`,
        societyId: society.id,
        userId: user.id,
        flatNumber: 'Pending Verification',
        role: 'RESIDENT',
        status: 'PENDING_APPROVAL',
        createdAt: now,
        updatedAt: now,
      });
    }

    const sessionCookie = await createSessionCookieValue(idToken, identity);

    // Residents of several societies pick one to work in after signing in
    let societies: SocietySummary[] = [];
    if (!joining && !activated) {
      const usable = (await repo.listUserMemberships(user.id)).filter(
        (m) => m.status !== 'REJECTED' && m.status !== 'DEACTIVATED'
      );
      if (usable.length > 1) {
        for (const m of usable) {
          const s = await repo.getSocietyById(m.societyId);
          if (s && s.status === 'ACTIVE') societies.push({ id: s.id, slug: s.slug, name: s.name, address: s.address });
        }
        if (societies.length < 2) societies = [];
      }
    }

    const response = NextResponse.json({
      success: true,
      user,
      membership,
      societyId: society.id,
      ...(activated ? { activatedSociety: { id: activated.id, name: activated.name } } : {}),
      ...(societies.length > 1 ? { chooseSociety: true, societies } : {}),
    });

    const secure = process.env.NODE_ENV === 'production';
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set(SOCIETY_COOKIE, society.id, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    for (const name of LEGACY_COOKIES) response.cookies.delete(name);

    return response;
  } catch (err) {
    console.error('Session creation error:', err);
    return errorResponse('Unable to sign in right now. Please try again.', 500);
  }
}

// Sign out: revoke the Firebase session and clear cookies
export async function DELETE(req: NextRequest) {
  await revokeSessions(req.cookies.get(SESSION_COOKIE)?.value);

  const response = NextResponse.json({ success: true, message: 'Logged out' });
  for (const name of [SESSION_COOKIE, SOCIETY_COOKIE, ...LEGACY_COOKIES]) {
    response.cookies.delete(name);
  }
  return response;
}
