import { ISocietyRepository } from '@/lib/db/repository.interface';
import { Society, User } from '@/types';

/** Last 10 digits of an Indian mobile, for comparing numbers written differently */
export function mobileKey(mobile: string | undefined): string {
  return (mobile ?? '').replace(/\D/g, '').slice(-10);
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'society'
  );
}

/**
 * A short invite code from the society's initials and random digits, e.g.
 * "MR4821". Retries until it is unused.
 */
export async function generateSocietyCode(repo: ISocietyRepository, name: string): Promise<string> {
  const letters =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 3) || 'CH';
  for (let attempt = 0; attempt < 20; attempt++) {
    const digits = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
    const code = `${letters}${digits}`;
    if (!(await repo.getSocietyByCode(code))) return code;
  }
  throw new Error('Could not generate a unique society code');
}

/** Societies still being set up whose admin is this mobile number */
export async function findSocietiesAwaitingAdmin(
  repo: ISocietyRepository,
  mobile: string | undefined
): Promise<Society[]> {
  const key = mobileKey(mobile);
  if (key.length !== 10) return [];
  return (await repo.listSocieties()).filter(
    (s) =>
      (s.status === 'PENDING_SETUP' && mobileKey(s.pendingAdminMobile) === key) ||
      (s.status === 'ACTIVE' && (s.adminInvites ?? []).some((m) => mobileKey(m) === key))
  );
}

/**
 * The named admin has signed in with their mobile (verified by OTP): make
 * them the society admin, open the society for residents and record it.
 */
export async function activateSocietyForAdmin(
  repo: ISocietyRepository,
  society: Society,
  user: User
): Promise<Society> {
  const now = new Date().toISOString();
  const existing = await repo.getMembership(society.id, user.id);
  if (existing) {
    await repo.updateMembership(society.id, user.id, { role: 'SOCIETY_ADMIN', status: 'ACTIVE', approvedAt: now });
  } else {
    await repo.createMembership({
      id: `mem-${crypto.randomUUID()}`,
      societyId: society.id,
      userId: user.id,
      flatNumber: 'Not set',
      role: 'SOCIETY_ADMIN',
      status: 'ACTIVE',
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const wasLive = society.status === 'ACTIVE';
  const userKey = mobileKey(user.mobile);
  const activated = await repo.updateSociety(
    society.id,
    wasLive
      ? // An extra admin invited to a live society: just use up the invitation
        { adminInvites: (society.adminInvites ?? []).filter((m) => mobileKey(m) !== userKey) }
      : { status: 'ACTIVE', pendingAdminMobile: undefined, pendingAdminName: undefined, activatedAt: now }
  );

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: society.id,
    actorUserId: user.id,
    action: wasLive ? 'SOCIETY_ADMIN_JOINED' : 'SOCIETY_ACTIVATED',
    entityType: 'SOCIETY',
    entityId: society.id,
    metadata: { adminUserId: user.id },
    createdAt: now,
  });

  return activated;
}
