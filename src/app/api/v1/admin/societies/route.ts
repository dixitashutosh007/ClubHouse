import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { CreateSocietySchema, UpdatePendingSocietySchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';
import { generateSocietyCode, mobileKey, slugify } from '@/lib/services/society-onboarding';
import { Society } from '@/types';

/** What the app admin sees for each society; the invite code only once it is live */
function adminView(s: Society) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    status: s.status,
    createdAt: s.createdAt,
    activatedAt: s.activatedAt,
    pendingAdminName: s.pendingAdminName,
    pendingAdminMobile: s.pendingAdminMobile,
    inviteCode: s.status === 'ACTIVE' ? s.code : undefined,
  };
}

// All societies on the platform (app admins only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const societies = (await getRepository().listSocieties()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ societies: societies.map(adminView) });
}

// Add a society from the onboarding wizard. It stays closed until its admin signs in.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateSocietySchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const all = await repo.listSocieties();
  if (all.some((s) => s.name.trim().toLowerCase() === body.name.toLowerCase() && s.status !== 'INACTIVE')) {
    return errorResponse('A society with this name already exists', 409);
  }
  if (all.some((s) => s.status === 'PENDING_SETUP' && mobileKey(s.pendingAdminMobile) === mobileKey(body.adminMobile))) {
    return errorResponse('This mobile number is already the admin of a society being set up', 409);
  }

  const now = new Date().toISOString();
  const { emergencyNumber, ...settings } = body.settings;
  const society: Society = {
    id: `soc-${crypto.randomUUID()}`,
    slug: slugify(body.name),
    name: body.name,
    code: await generateSocietyCode(repo, body.name),
    address: body.address,
    latitude: body.latitude,
    longitude: body.longitude,
    settings: { ...settings, ...(emergencyNumber ? { emergencyNumber } : {}) },
    status: 'PENDING_SETUP',
    pendingAdminName: body.adminName,
    pendingAdminMobile: body.adminMobile,
    createdBy: auth.userId,
    createdAt: now,
  };
  await repo.createSociety(society);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: society.id,
    actorUserId: auth.userId,
    action: 'SOCIETY_CREATED',
    entityType: 'SOCIETY',
    entityId: society.id,
    metadata: { name: society.name, adminMobile: body.adminMobile },
    createdAt: now,
  });

  return NextResponse.json({ success: true, society: adminView(society) });
}

// Change the admin of a society still being set up, or cancel it
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, { roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdatePendingSocietySchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const society = await repo.getSocietyById(body.societyId);
  if (!society) return errorResponse('Society not found', 404);
  if (society.status !== 'PENDING_SETUP') return errorResponse('Only societies still being set up can be changed here', 409);

  let updated: Society;
  if (body.action === 'CANCEL') {
    updated = await repo.updateSociety(society.id, { status: 'INACTIVE', pendingAdminMobile: undefined });
  } else {
    if (!body.adminMobile || !body.adminName) return errorResponse("Enter the new admin's name and mobile number");
    updated = await repo.updateSociety(society.id, { pendingAdminName: body.adminName, pendingAdminMobile: body.adminMobile });
  }

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: society.id,
    actorUserId: auth.userId,
    action: body.action === 'CANCEL' ? 'SOCIETY_SETUP_CANCELLED' : 'SOCIETY_ADMIN_CHANGED',
    entityType: 'SOCIETY',
    entityId: society.id,
    metadata: body.action === 'CANCEL' ? {} : { adminMobile: body.adminMobile },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, society: adminView(updated) });
}
