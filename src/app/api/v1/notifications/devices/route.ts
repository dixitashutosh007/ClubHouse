import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { ONBOARDING_STATUSES, errorResponse, requireAuth } from '@/lib/api-auth';
import { parseBody } from '@/lib/validation/parse';
import { PushTokenSchema } from '@/lib/validation/schemas';
import { pushDeviceId } from '@/lib/services/push';
import { rateLimit } from '@/lib/rate-limit';

// This browser wants push notifications for the signed-in resident
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, PushTokenSchema);
  if (body instanceof NextResponse) return body;

  const limit = await rateLimit(`push-device:${auth.userId}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) return errorResponse('Too many requests. Please try again later.', 429);

  const now = new Date().toISOString();
  // A token moves to whoever signs in on that browser
  await getRepository().savePushDevice({
    id: pushDeviceId(body.token),
    userId: auth.userId,
    token: body.token,
    createdAt: now,
    lastSeenAt: now,
  });
  return NextResponse.json({ success: true });
}

// Stop push notifications on this browser (e.g. on sign out)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, PushTokenSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const id = pushDeviceId(body.token);
  const mine = (await repo.listPushDevices(auth.userId)).some((d) => d.id === id);
  if (mine) await repo.deletePushDevice(id);
  return NextResponse.json({ success: true });
}
