import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, serverError } from '@/lib/api-auth';
import { isDevAuthEnabled, verifyFreshIdToken } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { parseBody } from '@/lib/validation/parse';
import { SocietySearchSchema } from '@/lib/validation/schemas';

const MAX_RESULTS = 10;

/**
 * Society search for a number that has just been verified by SMS but belongs
 * to no society yet. There is no session at this point, so the caller proves
 * the fresh phone sign-in with its Firebase ID token (in the body, never the
 * URL). Results never include the invite code: joining from here uses the
 * society ID and only ever creates a membership a society admin must approve.
 */
export async function POST(req: NextRequest) {
  const limit = await rateLimit(`society-search:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many searches. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const body = await parseBody(req, SocietySearchSchema);
  if (body instanceof NextResponse) return body;

  const identity = await verifyFreshIdToken(body.idToken);
  if (!identity || (!identity.phoneNumber && !isDevAuthEnabled())) {
    return errorResponse('Your verification has expired. Please verify your mobile again.', 401);
  }

  try {
    const query = body.query.toLowerCase();
    const societies = (await getRepository().listSocieties())
      .filter((s) => s.status === 'ACTIVE')
      .filter((s) => s.name.toLowerCase().includes(query) || s.address.toLowerCase().includes(query))
      .slice(0, MAX_RESULTS)
      .map(({ id, name, address }) => ({ id, name, address }));

    return NextResponse.json({ societies });
  } catch (err) {
    return serverError('Society search failed', err);
  }
}
