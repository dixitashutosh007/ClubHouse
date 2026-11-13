import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ONBOARDING_STATUSES, errorResponse, requireAuth } from '@/lib/api-auth';
import { isDevAuthEnabled, verifyFreshIdToken } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { VerifyPhoneChangeSchema } from '@/lib/validation/schemas';

/**
 * Verified mobile number change.
 *
 * The client links the new number to the signed-in Firebase account with
 * updatePhoneNumber() (SMS OTP), then sends a fresh ID token. The new number
 * is taken from the verified token, never from the request body.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const limit = await rateLimit(`phone-change:${auth.userId}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many mobile number changes. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const parsed = VerifyPhoneChangeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse('Missing verification token');
  const { idToken, devPhoneNumber } = parsed.data;

  const identity = await verifyFreshIdToken(idToken, 'iat');
  if (!identity || identity.uid !== auth.authUid) {
    return errorResponse('Mobile verification failed. Please try again.', 401);
  }

  const newPhone = identity.phoneNumber ?? (isDevAuthEnabled() ? devPhoneNumber : undefined);
  if (!newPhone) return errorResponse('Mobile verification failed. Please try again.', 401);

  const repo = getRepository();
  const existing = await repo.getUserByPhone(newPhone);
  if (existing && existing.id !== auth.userId) {
    return errorResponse('This mobile number is already registered to another resident.', 409);
  }

  const user = await repo.updateUser(auth.userId, { mobile: newPhone });

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'MOBILE_NUMBER_CHANGED',
    entityType: 'USER',
    entityId: auth.userId,
    metadata: {},
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, user });
}
