import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, getSessionUser } from '@/lib/api-auth';
import { parseBody } from '@/lib/validation/parse';
import { DeleteAccountSchema } from '@/lib/validation/schemas';
import { deleteAccount } from '@/lib/services/account';
import { LEGACY_COOKIES, SESSION_COOKIE, SOCIETY_COOKIE, deleteSignInAccount } from '@/lib/auth/session';

// Delete my account: personal details are erased and the account can't sign in again
export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse('Unauthorized', 401);

  const body = await parseBody(req, DeleteAccountSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const memberships = await repo.listUserMemberships(session.user.id);
  for (const m of memberships) {
    if (m.role !== 'SOCIETY_ADMIN' || m.status !== 'ACTIVE') continue;
    const otherAdmins = (await repo.listSocietyMembers(m.societyId)).filter(
      (x) => x.role === 'SOCIETY_ADMIN' && x.status === 'ACTIVE' && x.userId !== session.user.id
    );
    if (otherAdmins.length === 0) {
      return errorResponse('You are the only admin of a society. Make another resident an admin first.', 409);
    }
  }

  await deleteAccount(repo, session.user.id);
  await deleteSignInAccount(session.authUid);

  const response = NextResponse.json({ success: true });
  for (const name of [SESSION_COOKIE, SOCIETY_COOKIE, ...LEGACY_COOKIES]) response.cookies.delete(name);
  return response;
}
