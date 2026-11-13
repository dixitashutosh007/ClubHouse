import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { parseQuery } from '@/lib/validation/parse';
import { ScheduleIdQuerySchema } from '@/lib/validation/schemas';

// Your repeating rides
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const schedules = await getRepository().listUserSchedules(auth.societyId, auth.userId);
  return NextResponse.json({ schedules });
}

// Stop repeating a ride. Rides already created stay; cancel any of them separately.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ScheduleIdQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  const schedule = await repo.getRideSchedule(auth.societyId, query.id);
  if (!schedule) return errorResponse('Repeating ride not found', 404);
  if (schedule.userId !== auth.userId) return errorResponse('Only its owner can stop a repeating ride', 403);

  await repo.deactivateSchedule(auth.societyId, schedule.id, auth.userId);
  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'RIDE_SCHEDULE_STOPPED',
    entityType: 'RIDE_SCHEDULE',
    entityId: schedule.id,
    metadata: {},
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}
