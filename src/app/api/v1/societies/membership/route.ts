import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRepository } from '@/lib/db';
import { errorResponse, getSessionUser } from '@/lib/api-auth';
import { parseQuery } from '@/lib/validation/parse';
import { rateLimit } from '@/lib/rate-limit';

const Query = z
  .object({ code: z.string().trim().min(2).max(32).optional(), id: z.string().trim().min(1).max(128).optional() })
  .refine((q) => Boolean(q.code || q.id), 'Society code or ID required');

/**
 * For the join page: is the signed-in user already in this society? Lets an
 * existing member who opens an invite link go straight in instead of seeing
 * the registration form again.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return errorResponse('Unauthorized', 401);

  const query = parseQuery(req, Query);
  if (query instanceof NextResponse) return query;

  const limit = await rateLimit(`membership-check:${session.user.id}`, 30, 10 * 60 * 1000);
  if (!limit.allowed) return errorResponse('Too many requests. Please try again later.', 429);

  const repo = getRepository();
  const society = query.code ? await repo.getSocietyByCode(query.code) : await repo.getSocietyById(query.id!);
  if (!society || society.status !== 'ACTIVE') return errorResponse('Society not found', 404);

  const membership = await repo.getMembership(society.id, session.user.id);
  // A membership created by signing in through the invite link isn't a registration yet
  const registered = Boolean(membership && membership.flatNumber && membership.flatNumber !== 'Pending Verification');
  return NextResponse.json({
    societyId: society.id,
    societyName: society.name,
    status: membership?.status ?? null,
    registered,
  });
}
