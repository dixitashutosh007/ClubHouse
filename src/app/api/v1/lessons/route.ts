import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { getAuthContext, errorResponse } from '@/lib/api-auth';
import { ClassListing, ClassStatus, ClassType } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);
  if (auth.status !== 'ACTIVE') return errorResponse('Membership not active', 403);

  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') || undefined;
  const classType = (searchParams.get('classType') as ClassType) || undefined;
  const isMine = searchParams.get('mine') === 'true';
  const isPending = searchParams.get('pending') === 'true';

  const repo = getRepository();

  if (isPending) {
    if (auth.role !== 'SOCIETY_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('Forbidden: Society Admin role required for pending classes', 403);
    }
    const pendingClasses = await repo.listPendingClasses(auth.societyId);
    return NextResponse.json({ classes: pendingClasses });
  }

  if (isMine) {
    const userClasses = await repo.listUserClasses(auth.societyId, auth.userId);
    return NextResponse.json({ classes: userClasses });
  }

  const activeClasses = await repo.listActiveClasses(auth.societyId, subject, classType);
  return NextResponse.json({ classes: activeClasses });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);
  if (auth.status !== 'ACTIVE') return errorResponse('Only active verified residents can post classes', 403);

  const body = await req.json();
  const {
    classType,
    subject,
    isCustomSubject,
    description,
    feeType,
    feeAmount,
    contactName,
    contactPhone,
    locationType,
    locationDetail,
    noAgeLimit,
    ageMin,
    ageMax,
    scheduleDays,
    startTime,
    durationMinutes,
    trialAvailable,
    expiresOn,
    photoUrl,
  } = body;

  if (!subject || !classType || !feeType || !description || !contactName || !contactPhone || !locationType) {
    return errorResponse('Missing required fields for class listing', 400);
  }

  const repo = getRepository();
  const membership = await repo.getMembership(auth.societyId, auth.userId);
  const user = await repo.getUserById(auth.userId);

  const listingId = `lsn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newListing: ClassListing = {
    id: listingId,
    societyId: auth.societyId,
    createdByUserId: auth.userId,
    classType,
    subject: String(subject).trim(),
    isCustomSubject: Boolean(isCustomSubject),
    description: String(description).trim(),
    feeType,
    feeAmount: feeType === 'FREE' ? undefined : (feeAmount ? Number(feeAmount) : undefined),
    contactName: String(contactName).trim(),
    contactPhone: String(contactPhone).trim(),
    locationType,
    locationDetail: locationDetail ? String(locationDetail).trim() : undefined,
    noAgeLimit: Boolean(noAgeLimit),
    ageMin: noAgeLimit ? undefined : (ageMin ? Number(ageMin) : undefined),
    ageMax: noAgeLimit ? undefined : (ageMax ? Number(ageMax) : undefined),
    scheduleDays: Array.isArray(scheduleDays) && scheduleDays.length > 0 ? scheduleDays : ['FLEXIBLE'],
    startTime: startTime || undefined,
    durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
    trialAvailable: Boolean(trialAvailable),
    expiresOn: expiresOn || undefined,
    photoUrl: photoUrl || undefined,
    status: 'PENDING_APPROVAL',
    creatorName: user?.fullName || contactName,
    creatorFlat: membership?.flatNumber,
    createdAt: now,
    updatedAt: now,
  };

  const created = await repo.createClassListing(newListing);

  // Record audit event
  await repo.recordAuditEvent({
    id: `audit-${Date.now()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_CREATED',
    entityType: 'LESSON',
    entityId: created.id,
    metadata: {
      subject: created.subject,
      classType: created.classType,
      feeType: created.feeType,
      feeAmount: created.feeAmount,
    },
    createdAt: now,
  });

  return NextResponse.json({ success: true, listing: created });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);
  if (auth.status !== 'ACTIVE') return errorResponse('Membership not active', 403);

  const body = await req.json();
  const { listingId, ...updates } = body;

  if (!listingId) {
    return errorResponse('Missing listingId', 400);
  }

  const repo = getRepository();
  const existing = await repo.getClassListing(auth.societyId, listingId);
  if (!existing) {
    return errorResponse('Class listing not found', 404);
  }

  if (existing.createdByUserId !== auth.userId && auth.role !== 'SOCIETY_ADMIN' && auth.role !== 'SUPER_ADMIN') {
    return errorResponse('Forbidden: only listing owner or admin can edit this class', 403);
  }

  const sanitizedUpdates: Partial<ClassListing> = {};
  if (updates.subject !== undefined) sanitizedUpdates.subject = String(updates.subject).trim();
  if (updates.isCustomSubject !== undefined) sanitizedUpdates.isCustomSubject = Boolean(updates.isCustomSubject);
  if (updates.classType !== undefined) sanitizedUpdates.classType = updates.classType;
  if (updates.description !== undefined) sanitizedUpdates.description = String(updates.description).trim();
  if (updates.feeType !== undefined) sanitizedUpdates.feeType = updates.feeType;
  if (updates.feeAmount !== undefined) sanitizedUpdates.feeAmount = Number(updates.feeAmount);
  if (updates.contactName !== undefined) sanitizedUpdates.contactName = String(updates.contactName).trim();
  if (updates.contactPhone !== undefined) sanitizedUpdates.contactPhone = String(updates.contactPhone).trim();
  if (updates.locationType !== undefined) sanitizedUpdates.locationType = updates.locationType;
  if (updates.locationDetail !== undefined) sanitizedUpdates.locationDetail = String(updates.locationDetail).trim();
  if (updates.noAgeLimit !== undefined) sanitizedUpdates.noAgeLimit = Boolean(updates.noAgeLimit);
  if (updates.ageMin !== undefined) sanitizedUpdates.ageMin = Number(updates.ageMin);
  if (updates.ageMax !== undefined) sanitizedUpdates.ageMax = Number(updates.ageMax);
  if (updates.scheduleDays !== undefined) sanitizedUpdates.scheduleDays = updates.scheduleDays;
  if (updates.startTime !== undefined) sanitizedUpdates.startTime = updates.startTime;
  if (updates.durationMinutes !== undefined) sanitizedUpdates.durationMinutes = Number(updates.durationMinutes);
  if (updates.trialAvailable !== undefined) sanitizedUpdates.trialAvailable = Boolean(updates.trialAvailable);
  if (updates.expiresOn !== undefined) sanitizedUpdates.expiresOn = updates.expiresOn;
  if (updates.photoUrl !== undefined) sanitizedUpdates.photoUrl = updates.photoUrl;

  const updated = await repo.updateClassListing(
    auth.societyId,
    listingId,
    existing.createdByUserId,
    sanitizedUpdates
  );

  await repo.recordAuditEvent({
    id: `audit-${Date.now()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_UPDATED',
    entityType: 'LESSON',
    entityId: listingId,
    metadata: { updates: sanitizedUpdates },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, listing: updated });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);
  if (auth.status !== 'ACTIVE') return errorResponse('Membership not active', 403);

  const body = await req.json();
  const { listingId, action, reason } = body;

  if (!listingId || !action) {
    return errorResponse('Missing listingId or action', 400);
  }

  const repo = getRepository();
  const existing = await repo.getClassListing(auth.societyId, listingId);
  if (!existing) {
    return errorResponse('Class listing not found', 404);
  }

  const isOwner = existing.createdByUserId === auth.userId;
  const isAdmin = auth.role === 'SOCIETY_ADMIN' || auth.role === 'SUPER_ADMIN';

  let newStatus: ClassStatus;

  switch (action) {
    case 'APPROVE':
      if (!isAdmin) return errorResponse('Only society admins can approve class listings', 403);
      newStatus = 'ACTIVE';
      break;
    case 'REJECT':
      if (!isAdmin) return errorResponse('Only society admins can reject class listings', 403);
      newStatus = 'REJECTED';
      break;
    case 'MARK_FULL':
      if (!isOwner && !isAdmin) return errorResponse('Forbidden', 403);
      newStatus = 'FULL';
      break;
    case 'DEACTIVATE':
      if (!isOwner && !isAdmin) return errorResponse('Forbidden', 403);
      newStatus = 'DEACTIVATED';
      break;
    case 'REACTIVATE':
      if (!isOwner && !isAdmin) return errorResponse('Forbidden', 403);
      newStatus = 'ACTIVE';
      break;
    default:
      return errorResponse(`Invalid action: ${action}`, 400);
  }

  const updated = await repo.updateClassStatus(
    auth.societyId,
    listingId,
    newStatus,
    auth.userId,
    reason
  );

  await repo.recordAuditEvent({
    id: `audit-${Date.now()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: `LESSON_${action}`,
    entityType: 'LESSON',
    entityId: listingId,
    metadata: { previousStatus: existing.status, newStatus, reason },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, listing: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get('id');
  if (!listingId) return errorResponse('Missing listing id', 400);

  const repo = getRepository();
  const existing = await repo.getClassListing(auth.societyId, listingId);
  if (!existing) return errorResponse('Listing not found', 404);

  const isOwner = existing.createdByUserId === auth.userId;
  const isAdmin = auth.role === 'SOCIETY_ADMIN' || auth.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) return errorResponse('Forbidden', 403);

  await repo.deleteClassListing(auth.societyId, listingId, existing.createdByUserId);

  await repo.recordAuditEvent({
    id: `audit-${Date.now()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_DELETED',
    entityType: 'LESSON',
    entityId: listingId,
    metadata: { subject: existing.subject },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
