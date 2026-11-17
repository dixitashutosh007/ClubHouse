import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth, serverError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { CircleMessagesQuerySchema, DeleteCircleMessageSchema, PostCircleMessageSchema } from '@/lib/validation/schemas';
import { MESSAGE_GAP_SECONDS, MESSAGE_HISTORY_DAYS } from '@/lib/validation/circle-message';
import { peopleFor } from '@/lib/services/circles';
import { isCircleArchived } from '@/lib/circle-types';
import type { Circle, CircleMember } from '@/types';

/** Messages sent in one load at most (the newest are kept) */
const PAGE = 200;

const historyStart = (now: number) => new Date(now - MESSAGE_HISTORY_DAYS * 86_400_000).toISOString();

/**
 * Messages are for approved members only. Society admins who are not members
 * cannot read them, and anyone removed or declined loses access at once
 * because membership is checked on every request.
 */
type Access = { error: NextResponse } | { error?: undefined; circle: Circle; member: CircleMember };

async function memberOf(societyId: string, circleId: string, userId: string): Promise<Access> {
  const repo = getRepository();
  const circle = await repo.getCircle(societyId, circleId);
  // Archived circles (closed over 60 days) are no longer open to members
  if (!circle || isCircleArchived(circle)) return { error: errorResponse('Circle not found', 404) };
  const member = await repo.getCircleMember(societyId, circleId, userId);
  if (member?.status !== 'APPROVED') return { error: errorResponse('Only members of this circle can see its messages', 403) };
  return { circle, member };
}

const isCircleAdmin = (m: CircleMember) => m.role === 'OWNER' || m.role === 'CO_ADMIN';

// The last 30 days of messages, or only those after `after` (the 15-second refresh)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = parseQuery(req, CircleMessagesQuerySchema);
  if (query instanceof NextResponse) return query;

  try {
    const repo = getRepository();
    const found = await memberOf(auth.societyId, query.circleId, auth.userId);
    if (found.error) return found.error;
    const { circle, member } = found;

    const start = historyStart(Date.now());
    const after = query.after && query.after > start ? query.after : start;
    const messages = await repo.listCircleMessages(auth.societyId, circle.id, after, PAGE);
    const people = await peopleFor(repo, [...new Set(messages.map((m) => m.userId))]);
    const admin = isCircleAdmin(member);

    // Opening the messages marks them read
    const newest = messages.at(-1)?.createdAt;
    if (newest && (!member.lastReadAt || newest > member.lastReadAt)) {
      await repo.saveCircleMember({ ...member, lastReadAt: newest });
    }

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        userId: m.userId,
        // Names only, never numbers
        name: people.get(m.userId)?.fullName ?? 'Former member',
        text: m.text,
        createdAt: m.createdAt,
        mine: m.userId === auth.userId,
        canDelete: m.userId === auth.userId || admin,
      })),
      canPost: circle.status === 'ACTIVE',
    });
  } catch (err) {
    return serverError('circle messages GET', err);
  }
}

// Post a text message (no emoji, at most 150 words, one every 10 seconds)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await parseBody(req, PostCircleMessageSchema);
  if (body instanceof NextResponse) return body;

  try {
    const repo = getRepository();
    const found = await memberOf(auth.societyId, body.circleId, auth.userId);
    if (found.error) return found.error;
    const { circle, member } = found;
    if (circle.status !== 'ACTIVE') return errorResponse('Messages can only be sent in a live circle', 409);

    const limit = await rateLimit(`circle-message:${auth.societyId}:${auth.userId}`, 1, MESSAGE_GAP_SECONDS * 1000);
    if (!limit.allowed) {
      const res = errorResponse(`Please wait ${limit.retryAfterSeconds} seconds before sending another message.`, 429);
      res.headers.set('Retry-After', String(limit.retryAfterSeconds));
      return res;
    }

    const now = Date.now();
    const message = {
      id: `msg-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      circleId: circle.id,
      userId: auth.userId,
      text: body.text.trim(),
      createdAt: new Date(now).toISOString(),
    };
    await repo.createCircleMessage(message);
    // Your own message never counts as unread
    await repo.saveCircleMember({ ...member, lastReadAt: message.createdAt });
    // Tidy history older than 30 days as messages arrive (best effort)
    await repo.deleteCircleMessagesBefore(auth.societyId, circle.id, historyStart(now), 100).catch(() => 0);

    return NextResponse.json({ success: true, message: { ...message, mine: true, canDelete: true } });
  } catch (err) {
    return serverError('circle messages POST', err);
  }
}

// Delete a message: your own, or any message if you run the circle (no editing)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = parseQuery(req, DeleteCircleMessageSchema);
  if (query instanceof NextResponse) return query;

  try {
    const repo = getRepository();
    const found = await memberOf(auth.societyId, query.circleId, auth.userId);
    if (found.error) return found.error;
    const { circle, member } = found;
    const message = await repo.getCircleMessage(auth.societyId, circle.id, query.messageId);
    if (!message) return errorResponse('Message not found', 404);
    const own = message.userId === auth.userId;
    if (!own && !isCircleAdmin(member)) return errorResponse('You can only delete your own messages', 403);

    await repo.deleteCircleMessage(auth.societyId, circle.id, message.id);
    if (!own) {
      // The text is not kept; only that a circle admin removed someone's message
      await repo.recordAuditEvent({
        id: `audit-${crypto.randomUUID()}`,
        societyId: auth.societyId,
        actorUserId: auth.userId,
        action: 'CIRCLE_MESSAGE_DELETED',
        entityType: 'CIRCLE',
        entityId: circle.id,
        metadata: { name: circle.name, targetUserId: message.userId },
        createdAt: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('circle messages DELETE', err);
  }
}
