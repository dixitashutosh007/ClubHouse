import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { parseQuery } from '@/lib/validation/parse';
import { SocietyIdQuerySchema } from '@/lib/validation/schemas';

// One society in full, with its admins (app admins only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, SocietyIdQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  const society = await repo.getSocietyById(query.id);
  if (!society) return errorResponse('Society not found', 404);

  const members = await repo.listSocietyMembers(society.id);
  const admins = members
    .filter((m) => (m.role === 'SOCIETY_ADMIN' || m.role === 'SUPER_ADMIN') && m.status === 'ACTIVE')
    .map((m) => ({ userId: m.userId, name: m.user.fullName, mobile: m.user.mobile, role: m.role, flatNumber: m.flatNumber }));

  return NextResponse.json({
    society: {
      id: society.id,
      name: society.name,
      address: society.address,
      status: society.status,
      inviteCode: society.status === 'ACTIVE' ? society.code : undefined,
      createdAt: society.createdAt,
      activatedAt: society.activatedAt,
      pendingAdminName: society.pendingAdminName,
      pendingAdminMobile: society.pendingAdminMobile,
    },
    counts: {
      residents: members.filter((m) => m.status === 'ACTIVE').length,
      waiting: members.filter((m) => m.status === 'PENDING_APPROVAL' || m.status === 'REGISTERED').length,
    },
    admins,
    invitedAdmins: society.adminInvites ?? [],
  });
}
