import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { parseBody } from '@/lib/validation/parse';
import { HideResidentSchema } from '@/lib/validation/schemas';

/**
 * Residents you have hidden. Once hidden, neither of you sees the other's
 * rides or ride requests. Nobody is told; you can unhide them at any time.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  const me = await repo.getMembership(auth.societyId, auth.userId);
  const hidden = await Promise.all(
    (me?.hiddenUserIds ?? []).map(async (userId) => ({
      userId,
      name: (await repo.getUserById(userId))?.fullName ?? 'Former resident',
    }))
  );
  return NextResponse.json({ hidden });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, HideResidentSchema);
  if (body instanceof NextResponse) return body;
  if (body.userId === auth.userId) return errorResponse('You cannot hide yourself');

  const repo = getRepository();
  const target = await repo.getMembership(auth.societyId, body.userId);
  if (!target) return errorResponse('Resident not found', 404);

  const me = await repo.getMembership(auth.societyId, auth.userId);
  const current = me?.hiddenUserIds ?? [];
  if (!current.includes(body.userId)) {
    await repo.updateMembership(auth.societyId, auth.userId, { hiddenUserIds: [...current, body.userId] });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, HideResidentSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const me = await repo.getMembership(auth.societyId, auth.userId);
  await repo.updateMembership(auth.societyId, auth.userId, {
    hiddenUserIds: (me?.hiddenUserIds ?? []).filter((id) => id !== body.userId),
  });
  return NextResponse.json({ success: true });
}
