import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, hasAdminPermission, requireAuth } from '@/lib/api-auth';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { ClassInterestQuerySchema, ClassInterestSchema } from '@/lib/validation/schemas';
import { notify } from '@/lib/services/push';

/**
 * With ?listingId: who is interested in that class, with contact details
 * (its teacher and class approvers only). Without: the classes the
 * resident is interested in.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ClassInterestQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  if (!query.listingId) {
    const mine = await repo.listUserClassInterests(auth.societyId, auth.userId);
    return NextResponse.json({ listingIds: mine.map((i) => i.listingId) });
  }

  const listing = await repo.getClassListing(auth.societyId, query.listingId);
  if (!listing) return errorResponse('Class not found', 404);
  if (listing.createdByUserId !== auth.userId && !hasAdminPermission(auth, 'canApproveClasses')) {
    return errorResponse('Only the teacher can see who is interested', 403);
  }

  const interests = await repo.listClassInterests(auth.societyId, listing.id);
  const people = await Promise.all(
    interests.map(async (i) => {
      const [user, membership] = await Promise.all([
        repo.getUserById(i.userId),
        repo.getMembership(auth.societyId, i.userId),
      ]);
      if (!user || user.deletedAt || membership?.status !== 'ACTIVE') return null;
      return {
        userId: i.userId,
        name: user.fullName,
        flatNumber: membership.flatNumber,
        mobile: user.mobile,
        since: i.createdAt,
      };
    })
  );
  return NextResponse.json({ interested: people.filter(Boolean) });
}

// "I'm interested": shares the resident's name, flat and mobile with the teacher only
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, ClassInterestSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const listing = await repo.getClassListing(auth.societyId, body.listingId);
  if (!listing || (listing.status !== 'ACTIVE' && listing.status !== 'FULL')) {
    return errorResponse('This class is not open', 404);
  }
  if (listing.createdByUserId === auth.userId) return errorResponse('This is your own class');

  const already = (await repo.listUserClassInterests(auth.societyId, auth.userId)).some(
    (i) => i.listingId === listing.id
  );
  if (!already) {
    const now = new Date().toISOString();
    await repo.saveClassInterest({
      id: `${listing.id}__${auth.userId}`,
      societyId: auth.societyId,
      listingId: listing.id,
      userId: auth.userId,
      createdAt: now,
    });
    const [user, membership] = await Promise.all([
      repo.getUserById(auth.userId),
      repo.getMembership(auth.societyId, auth.userId),
    ]);
    const who = `${user?.fullName.split(' ')[0] ?? 'A neighbour'}${membership?.flatNumber ? ` (${membership.flatNumber})` : ''}`;
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: listing.createdByUserId,
      title: `Someone is interested in your ${listing.subject} class`,
      body: `${who} would like to know more. Their contact details are in My classes.`,
      type: 'GENERAL',
      link: '/lessons/my-listings',
      read: false,
      createdAt: now,
    });
  }
  return NextResponse.json({ success: true, interested: true });
}

// No longer interested: the teacher stops seeing the resident's details
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, ClassInterestSchema);
  if (body instanceof NextResponse) return body;

  await getRepository().deleteClassInterest(auth.societyId, body.listingId, auth.userId);
  return NextResponse.json({ success: true, interested: false });
}
