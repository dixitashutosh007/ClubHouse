import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/api-auth';
import { ModerationReport } from '@/types';
import { ModerationReportSchema, UpdateReportSchema } from '@/lib/validation/schemas';
import { AUTO_SUSPEND_AFTER_UPHELD_REPORTS, shouldAutoSuspend } from '@/lib/services/moderation';
import { parseBody } from '@/lib/validation/parse';
import { notify } from '@/lib/services/push';

// Submit a resident or ride violation report
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, ModerationReportSchema);
  if (body instanceof NextResponse) return body;
  const { reportedUserId, journeyId, category, description } = body;

  if (reportedUserId === auth.userId) return errorResponse('You cannot report yourself');

  const repo = getRepository();
  if (!(await repo.getMembership(auth.societyId, reportedUserId))) {
    return errorResponse('Resident not found', 404);
  }
  if (journeyId && !(await repo.getRideOccurrence(auth.societyId, journeyId))) {
    return errorResponse('Journey not found', 404);
  }

  const report: ModerationReport = {
    id: `rep-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    journeyId,
    reporterId: auth.userId,
    reportedUserId,
    category,
    description,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };

  const saved = await repo.createModerationReport(report);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'INCIDENT_REPORTED',
    entityType: 'MODERATION_REPORT',
    entityId: saved.id,
    metadata: { reportedUserId, category },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, report: saved });
}

// List society moderation reports (Society Admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canModerateReports' });
  if (auth instanceof NextResponse) return auth;

  const repo = getRepository();
  const reports = await repo.listModerationReports(auth.societyId);
  return NextResponse.json({ reports });
}

// Update moderation report status (Society Admin only)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, { permission: 'canModerateReports' });
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdateReportSchema);
  if (body instanceof NextResponse) return body;
  const { reportId, status, resolutionNotes } = body;

  const repo = getRepository();
  const updated = await repo.updateModerationReportStatus(
    auth.societyId,
    reportId,
    status,
    resolutionNotes,
    auth.userId
  );
  if (!updated) return errorResponse('Report not found', 404);

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'MODERATION_REPORT_RESOLVED',
    entityType: 'MODERATION_REPORT',
    entityId: reportId,
    metadata: { status, resolutionNotes },
    createdAt: new Date().toISOString(),
  });

  // Repeat offenders lose access until an admin reactivates them
  let autoSuspended = false;
  if (status === 'RESOLVED') {
    const reportedUserId = updated.reportedUserId;
    const [reports, membership] = await Promise.all([
      repo.listModerationReports(auth.societyId),
      repo.getMembership(auth.societyId, reportedUserId),
    ]);
    if (shouldAutoSuspend(reports, membership)) {
      const reason = `Automatically suspended after ${AUTO_SUSPEND_AFTER_UPHELD_REPORTS} upheld reports`;
      await repo.updateMembershipStatus(auth.societyId, reportedUserId, 'SUSPENDED', auth.userId, reason);
      const now = new Date().toISOString();
      await repo.recordAuditEvent({
        id: `audit-${crypto.randomUUID()}`,
        societyId: auth.societyId,
        actorUserId: auth.userId,
        action: 'MEMBER_AUTO_SUSPENDED',
        entityType: 'MEMBERSHIP',
        entityId: membership!.id,
        metadata: { targetUserId: reportedUserId, triggeringReportId: reportId },
        createdAt: now,
      });
      await notify(repo, {
        id: `notif-${crypto.randomUUID()}`,
        societyId: auth.societyId,
        userId: reportedUserId,
        title: 'Your access is paused',
        body: 'Several reports about you were upheld by your society admins. Please contact them to restore access.',
        type: 'GENERAL',
        read: false,
        createdAt: now,
      });
      autoSuspended = true;
    }
  }

  return NextResponse.json({ success: true, report: updated, autoSuspended });
}
