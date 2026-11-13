import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, hasAdminPermission, requireAuth } from '@/lib/api-auth';
import { ClassListing, ClassStatus } from '@/types';
import {
  ClassActionSchema,
  ClassIdQuerySchema,
  CreateClassSchema,
  ListClassesQuerySchema,
  UpdateClassSchema,
} from '@/lib/validation/schemas';
import { parseBody, parseQuery } from '@/lib/validation/parse';

/** Fields that describe the class; editing any of them sends a live listing back for review */
const REVIEWED_FIELDS: (keyof ClassListing)[] = [
  'classType',
  'subject',
  'description',
  'feeType',
  'feeAmount',
  'contactName',
  'contactPhone',
  'locationType',
  'locationDetail',
  'ageMin',
  'ageMax',
  'noAgeLimit',
  'photoUrl',
];

// List classes: active ones for residents, your own, or pending ones for class approvers
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ListClassesQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();

  if (query.pending === 'true') {
    if (!hasAdminPermission(auth, 'canApproveClasses')) return errorResponse('Forbidden', 403);
    return NextResponse.json({ classes: await repo.listPendingClasses(auth.societyId) });
  }

  if (query.mine === 'true') {
    // The teacher also sees how many neighbours are interested in each class
    const mine = await repo.listUserClasses(auth.societyId, auth.userId);
    const classes = await Promise.all(
      mine.map(async (c) => ({ ...c, interestedCount: (await repo.listClassInterests(auth.societyId, c.id)).length }))
    );
    return NextResponse.json({ classes });
  }

  const classes = await repo.listActiveClasses(auth.societyId, query.subject, query.classType);
  return NextResponse.json({ classes });
}

// Post a class; it stays hidden until a class approver accepts it
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateClassSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const [membership, user] = await Promise.all([
    repo.getMembership(auth.societyId, auth.userId),
    repo.getUserById(auth.userId),
  ]);

  const now = new Date().toISOString();
  const listing: ClassListing = {
    id: `lsn-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    createdByUserId: auth.userId,
    classType: body.classType,
    subject: body.subject,
    isCustomSubject: body.isCustomSubject ?? false,
    description: body.description,
    feeType: body.feeType,
    feeAmount: body.feeType === 'FREE' ? undefined : body.feeAmount,
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    locationType: body.locationType,
    locationDetail: body.locationDetail || undefined,
    noAgeLimit: body.noAgeLimit,
    ageMin: body.noAgeLimit ? undefined : body.ageMin,
    ageMax: body.noAgeLimit ? undefined : body.ageMax,
    scheduleDays: body.scheduleDays?.length ? body.scheduleDays : ['FLEXIBLE'],
    startTime: body.startTime,
    durationMinutes: body.durationMinutes,
    trialAvailable: body.trialAvailable,
    expiresOn: body.expiresOn,
    photoUrl: body.photoUrl,
    status: 'PENDING_APPROVAL',
    creatorName: user?.fullName || body.contactName,
    creatorFlat: membership?.flatNumber,
    createdAt: now,
    updatedAt: now,
  };

  const created = await repo.createClassListing(listing);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_CREATED',
    entityType: 'LESSON',
    entityId: created.id,
    metadata: { subject: created.subject, classType: created.classType, feeType: created.feeType },
    createdAt: now,
  });

  return NextResponse.json({ success: true, listing: created });
}

// Edit a class (its owner, or a class approver)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdateClassSchema);
  if (body instanceof NextResponse) return body;
  const { listingId, ...changes } = body;

  const repo = getRepository();
  const existing = await repo.getClassListing(auth.societyId, listingId);
  if (!existing) return errorResponse('Class listing not found', 404);

  const isOwner = existing.createdByUserId === auth.userId;
  const isApprover = hasAdminPermission(auth, 'canApproveClasses');
  if (!isOwner && !isApprover) {
    return errorResponse('Only the class owner or a class approver can edit this class', 403);
  }

  const updates: Partial<ClassListing> = { ...changes };
  if (changes.photoUrl === '') updates.photoUrl = undefined;
  if (changes.feeType === 'FREE') updates.feeAmount = undefined;
  if (changes.noAgeLimit === true) {
    updates.ageMin = undefined;
    updates.ageMax = undefined;
  }

  // A resident changing what a live class says goes back through review
  const changesReviewedContent = REVIEWED_FIELDS.some((f) => f in changes);
  if (
    !isApprover &&
    changesReviewedContent &&
    (existing.status === 'ACTIVE' || existing.status === 'FULL' || existing.status === 'REJECTED')
  ) {
    updates.status = 'PENDING_APPROVAL';
  }

  const updated = await repo.updateClassListing(auth.societyId, listingId, existing.createdByUserId, updates);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_UPDATED',
    entityType: 'LESSON',
    entityId: listingId,
    metadata: {
      fields: Object.keys(changes),
      sentForReview: updates.status === 'PENDING_APPROVAL' && existing.status !== 'PENDING_APPROVAL',
    },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, listing: updated });
}

// Which statuses each action applies to, and what it changes the class to
const TRANSITIONS: Record<
  'APPROVE' | 'REJECT' | 'MARK_FULL' | 'DEACTIVATE' | 'REACTIVATE',
  { from: ClassStatus[]; to: ClassStatus; approverOnly: boolean }
> = {
  APPROVE: { from: ['PENDING_APPROVAL', 'REJECTED'], to: 'ACTIVE', approverOnly: true },
  REJECT: { from: ['PENDING_APPROVAL', 'ACTIVE', 'FULL'], to: 'REJECTED', approverOnly: true },
  MARK_FULL: { from: ['ACTIVE'], to: 'FULL', approverOnly: false },
  DEACTIVATE: { from: ['ACTIVE', 'FULL', 'PENDING_APPROVAL'], to: 'DEACTIVATED', approverOnly: false },
  // Reopening seats on a full class needs no review; a deactivated one goes back to review
  REACTIVATE: { from: ['FULL', 'DEACTIVATED'], to: 'ACTIVE', approverOnly: false },
};

// Approve, reject, mark full, deactivate or reactivate a class
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, ClassActionSchema);
  if (body instanceof NextResponse) return body;
  const { listingId, action, reason } = body;

  const repo = getRepository();
  const existing = await repo.getClassListing(auth.societyId, listingId);
  if (!existing) return errorResponse('Class listing not found', 404);

  const isOwner = existing.createdByUserId === auth.userId;
  const isApprover = hasAdminPermission(auth, 'canApproveClasses');
  const transition = TRANSITIONS[action];

  if (transition.approverOnly ? !isApprover : !isOwner && !isApprover) {
    return errorResponse('You are not allowed to change this class', 403);
  }
  if (!transition.from.includes(existing.status)) {
    return errorResponse(`Cannot ${action.toLowerCase().replace('_', ' ')} a class that is ${existing.status}`, 409);
  }

  const newStatus: ClassStatus =
    action === 'REACTIVATE' && existing.status === 'DEACTIVATED' && !isApprover ? 'PENDING_APPROVAL' : transition.to;

  const updated = await repo.updateClassStatus(auth.societyId, listingId, newStatus, auth.userId, reason);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
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

// Delete a class (its owner, or a class approver)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ClassIdQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  const existing = await repo.getClassListing(auth.societyId, query.id);
  if (!existing) return errorResponse('Class listing not found', 404);

  if (existing.createdByUserId !== auth.userId && !hasAdminPermission(auth, 'canApproveClasses')) {
    return errorResponse('Only the class owner or a class approver can delete this class', 403);
  }

  await repo.deleteClassListing(auth.societyId, query.id, existing.createdByUserId);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'LESSON_DELETED',
    entityType: 'LESSON',
    entityId: query.id,
    metadata: { subject: existing.subject },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
