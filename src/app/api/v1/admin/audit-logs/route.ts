import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// List activity logs for the society (Society Admin & App Admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canViewAuditLogs' });
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  const events = await repo.listAuditEvents(auth.societyId);

  // Names of who did it and who it was about, so the log reads as sentences
  const names = new Map<string, string>();
  const nameOf = async (userId: unknown): Promise<string | undefined> => {
    if (typeof userId !== 'string' || !userId) return undefined;
    if (!names.has(userId)) names.set(userId, (await repo.getUserById(userId))?.fullName ?? 'A former resident');
    return names.get(userId);
  };
  const enriched = await Promise.all(
    events.map(async (ev) => {
      const m = (ev.metadata ?? {}) as Record<string, unknown>;
      return {
        ...ev,
        actorName: (await nameOf(ev.actorUserId)) ?? 'Club House (automatic)',
        subjectName: await nameOf(m.targetUserId ?? m.seekerUserId ?? m.reportedUserId),
      };
    })
  );

  return NextResponse.json({ events: enriched });
}
