import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, getSessionUser } from '@/lib/api-auth';
import { MemberRegistrationSchema } from '@/lib/validation/schemas';

/**
 * Completes registration for a signed-in user joining a society by invite code.
 *
 * The user must already have verified their mobile number via phone OTP
 * (POST /api/v1/auth/session); identity comes from that session, never from
 * the submitted form.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse('Please verify your mobile number first', 401);

  const parseResult = MemberRegistrationSchema.safeParse(await req.json().catch(() => ({})));
  if (!parseResult.success) {
    return errorResponse(parseResult.error.issues[0]?.message || 'Invalid registration details');
  }
  const { societyCode, societyId, fullName, email, flatNumber, gender, workLocationName } = parseResult.data;

  try {
    const repo = getRepository();

    const society = societyCode ? await repo.getSocietyByCode(societyCode) : await repo.getSocietyById(societyId!);
    if (!society || society.status !== 'ACTIVE') {
      return errorResponse('Invalid or inactive society invitation code', 404);
    }

    const user = await repo.updateUser(session.user.id, {
      fullName,
      gender,
      workLocationName,
      ...(email !== session.user.email ? { email, emailVerified: false } : {}),
    });

    const now = new Date().toISOString();
    let membership = await repo.getMembership(society.id, user.id);

    if (membership && membership.status !== 'PENDING_APPROVAL' && membership.status !== 'REGISTERED') {
      return NextResponse.json({
        message: 'Membership already registered',
        user,
        society,
        membership,
      });
    }

    const status = society.settings.require_admin_approval ? 'PENDING_APPROVAL' : 'ACTIVE';

    if (membership) {
      // Sign-in created a pending membership; fill in the flat details
      membership = await repo.updateMembership(society.id, user.id, {
        flatNumber,
        status,
        updatedAt: now,
      });
    } else {
      membership = await repo.createMembership({
        id: `mem-${crypto.randomUUID()}`,
        societyId: society.id,
        userId: user.id,
        flatNumber,
        role: 'RESIDENT',
        status,
        createdAt: now,
        updatedAt: now,
      });
    }

    await repo.recordAuditEvent({
      id: `audit-${crypto.randomUUID()}`,
      societyId: society.id,
      actorUserId: user.id,
      action: 'RESIDENT_REGISTERED',
      entityType: 'MEMBERSHIP',
      entityId: membership.id,
      metadata: { flatNumber, status: membership.status },
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      user,
      society,
      membership,
    });
  } catch (err) {
    console.error('Registration failed:', err);
    return errorResponse('Registration failed. Please try again.', 500);
  }
}
