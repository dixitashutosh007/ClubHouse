import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { AnnouncementIdQuerySchema, CreateAnnouncementSchema } from '@/lib/validation/schemas';
import { notify } from '@/lib/services/push';
import { istDateString } from '@/lib/utils/time';
import { Announcement } from '@/types';

// Current notices for residents (expired ones are left out)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const today = istDateString();
  const all = await getRepository().listAnnouncements(auth.societyId);
  const current = all.filter((a) => !a.expiresOn || a.expiresOn >= today);
  return NextResponse.json({ announcements: current.slice(0, 10) });
}

// Post a notice to the whole society; residents also get it as a notification
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canManageSettings' });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateAnnouncementSchema);
  if (body instanceof NextResponse) return body;
  if (body.expiresOn && body.expiresOn < istDateString()) return errorResponse('The end date has already passed');

  const repo = getRepository();
  const now = new Date().toISOString();
  const announcement: Announcement = {
    id: `ann-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    title: body.title,
    body: body.body,
    createdBy: auth.userId,
    createdAt: now,
    ...(body.expiresOn ? { expiresOn: body.expiresOn } : {}),
  };
  await repo.createAnnouncement(announcement);

  let notified = 0;
  if (body.notify) {
    const members = (await repo.listSocietyMembers(auth.societyId)).filter(
      (m) => m.status === 'ACTIVE' && m.userId !== auth.userId
    );
    for (const m of members) {
      await notify(repo, {
        id: `notif-${crypto.randomUUID()}`,
        societyId: auth.societyId,
        userId: m.userId,
        title: body.title,
        body: body.body.length > 140 ? `${body.body.slice(0, 137)}…` : body.body,
        type: 'GENERAL',
        link: '/',
        read: false,
        createdAt: now,
      });
      notified++;
    }
  }

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'ANNOUNCEMENT_POSTED',
    entityType: 'ANNOUNCEMENT',
    entityId: announcement.id,
    metadata: { title: body.title, notified },
    createdAt: now,
  });

  return NextResponse.json({ success: true, announcement, notified });
}

// Take a notice down
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canManageSettings' });
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, AnnouncementIdQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  await repo.deleteAnnouncement(auth.societyId, query.id);
  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'ANNOUNCEMENT_REMOVED',
    entityType: 'ANNOUNCEMENT',
    entityId: query.id,
    metadata: {},
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}
