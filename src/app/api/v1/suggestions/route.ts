import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { SocietySuggestion } from '@/types';
import { CreateSuggestionSchema, UpdateSuggestionSchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';

// A resident suggests a change to the society's setup (pick-up points, class locations…) or reports a problem
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateSuggestionSchema);
  if (body instanceof NextResponse) return body;

  const limit = await rateLimit(`suggestion:${auth.userId}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) return errorResponse('Too many suggestions. Please try again later.', 429);

  const repo = getRepository();
  const user = await repo.getUserById(auth.userId);
  const suggestion: SocietySuggestion = {
    id: `sug-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    userId: auth.userId,
    userName: user?.fullName || 'Resident',
    module: body.module,
    kind: body.kind,
    message: body.message,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };
  await repo.createSuggestion(suggestion);

  return NextResponse.json({ success: true, suggestion: { id: suggestion.id } });
}

// Admins who manage settings read residents' suggestions
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canManageSettings' });
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ suggestions: await getRepository().listSuggestions(auth.societyId) });
}

// Mark a suggestion done (or reopen it)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canManageSettings' });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdateSuggestionSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const done = body.status === 'DONE';
  const updated = await repo.updateSuggestion(auth.societyId, body.suggestionId, {
    status: body.status,
    resolvedBy: done ? auth.userId : undefined,
    resolvedAt: done ? new Date().toISOString() : undefined,
  });
  if (!updated) return errorResponse('Suggestion not found', 404);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: done ? 'SUGGESTION_RESOLVED' : 'SUGGESTION_REOPENED',
    entityType: 'SUGGESTION',
    entityId: body.suggestionId,
    metadata: { module: updated.module },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, suggestion: updated });
}
