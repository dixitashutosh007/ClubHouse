/**
 * Plain-English sentences for the society activity log, e.g.
 * "Vikram Mehta approved Priya Sharma" instead of raw event data.
 */

export interface AuditEventView {
  action: string;
  actorName: string;
  /** The resident the event is about, when there is one */
  subjectName?: string;
  metadata?: Record<string, unknown>;
}

export type AuditTone = 'good' | 'bad' | 'neutral';

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

const ROLE: Record<string, string> = {
  RESIDENT: 'resident',
  SOCIETY_ADMIN: 'society admin',
  SUPER_ADMIN: 'app admin',
};

function humanize(action: string): string {
  return action.toLowerCase().replace(/_/g, ' ');
}

export function describeAuditEvent(e: AuditEventView): { text: string; tone: AuditTone } {
  const who = e.actorName || 'Someone';
  const them = e.subjectName || 'a resident';
  const m = e.metadata ?? {};
  const subject = str(m.subject);
  const dest = str(m.destinationName);
  const to = dest ? ` to ${dest}` : '';

  switch (e.action) {
    case 'RESIDENT_APPROVED':
    case 'RESIDENT_APPROVE':
      return { text: `${who} approved ${them}`, tone: 'good' };
    case 'RESIDENT_REJECTED':
    case 'RESIDENT_REJECT':
      return { text: `${who} rejected ${them}'s registration`, tone: 'bad' };
    case 'RESIDENT_SUSPEND':
      return { text: `${who} suspended ${them}`, tone: 'bad' };
    case 'RESIDENT_BLOCK':
      return { text: `${who} blocked ${them}`, tone: 'bad' };
    case 'RESIDENT_REACTIVATE':
      return { text: `${who} reactivated ${them}`, tone: 'good' };
    case 'RESIDENT_REGISTERED':
      return { text: `${who} registered${str(m.flatNumber) ? ` for flat ${str(m.flatNumber)}` : ''}`, tone: 'neutral' };
    case 'RBAC_ROLE_ASSIGNED':
    case 'APP_ADMIN_GRANTED':
    case 'RBAC_ROLE_PERMISSIONS_UPDATED':
      return { text: `${who} made ${them} a ${ROLE[str(m.role)] ?? 'member'} and updated their permissions`, tone: 'neutral' };
    case 'SOCIETY_SETTINGS_UPDATED':
    case 'SOCIETY_PROFILE_AND_SETTINGS_UPDATED':
      return { text: `${who} updated the society settings`, tone: 'neutral' };
    case 'LESSON_CATEGORIES_UPDATED':
      return { text: `${who} updated the class types`, tone: 'neutral' };
    case 'LESSON_CREATED':
      return { text: `${who} posted a ${subject || 'new'} class for approval`, tone: 'neutral' };
    case 'LESSON_UPDATED':
      return { text: `${who} edited a class`, tone: 'neutral' };
    case 'LESSON_DELETED':
      return { text: `${who} deleted the ${subject || ''} class`.replace('  ', ' '), tone: 'neutral' };
    case 'LESSON_APPROVE':
      return { text: `${who} approved a class`, tone: 'good' };
    case 'LESSON_REJECT':
      return { text: `${who} declined a class${str(m.reason) ? `: ${str(m.reason)}` : ''}`, tone: 'bad' };
    case 'LESSON_MARK_FULL':
      return { text: `${who} marked a class as full`, tone: 'neutral' };
    case 'LESSON_DEACTIVATE':
      return { text: `${who} paused a class`, tone: 'neutral' };
    case 'LESSON_REACTIVATE':
      return { text: `${who} reopened a class`, tone: 'neutral' };
    case 'RIDE_OFFERED':
      return { text: `${who} offered a ride${to}`, tone: 'neutral' };
    case 'RIDE_CANCELLED':
      return { text: `${who} cancelled a ride${to}`, tone: 'neutral' };
    case 'RIDE_STARTED':
      return { text: `${who} started a ride`, tone: 'neutral' };
    case 'RIDE_COMPLETED':
      return { text: `${who} completed a ride`, tone: 'good' };
    case 'RIDE_SCHEDULE_CREATED':
      return { text: `${who} set up a weekly ride${to}`, tone: 'neutral' };
    case 'RIDE_SCHEDULE_STOPPED':
      return { text: `${who} stopped a weekly ride`, tone: 'neutral' };
    case 'SEAT_REQUESTED':
      return { text: `${who} asked to join a ride`, tone: 'neutral' };
    case 'REQUEST_ACCEPTED_CONTACT_REVEALED':
      return { text: `${who} accepted ${them} on a ride; contact details were shared`, tone: 'good' };
    case 'INCIDENT_REPORTED':
      return { text: `${who} reported ${them}`, tone: 'bad' };
    case 'MODERATION_REPORT_RESOLVED':
      return { text: `${who} closed a report as ${str(m.status).toLowerCase() || 'resolved'}`, tone: 'neutral' };
    case 'MEMBER_AUTO_SUSPENDED':
      return { text: `${them} was suspended automatically after repeated upheld reports`, tone: 'bad' };
    case 'VEHICLE_REGISTERED':
      return { text: `${who} added a vehicle${str(m.make) ? ` (${str(m.make)} ${str(m.model)})` : ''}`, tone: 'neutral' };
    case 'MOBILE_NUMBER_CHANGED':
      return { text: `${who} changed their mobile number`, tone: 'neutral' };
    case 'SOCIETY_CREATED':
      return { text: `${who} added the society${str(m.name) ? ` ${str(m.name)}` : ''}`, tone: 'neutral' };
    case 'SOCIETY_ACTIVATED':
      return { text: `${who} verified as society admin; the society is now open`, tone: 'good' };
    case 'SOCIETY_SETUP_CANCELLED':
      return { text: `${who} cancelled the society setup`, tone: 'bad' };
    case 'SOCIETY_ADMIN_CHANGED':
      return { text: `${who} changed the society admin being set up`, tone: 'neutral' };
    case 'SUGGESTION_RESOLVED':
      return { text: `${who} marked a resident's suggestion as done`, tone: 'good' };
    case 'SUGGESTION_REOPENED':
      return { text: `${who} reopened a resident's suggestion`, tone: 'neutral' };
    case 'ANNOUNCEMENT_POSTED':
      return { text: `${who} posted a notice${str(m.title) ? `: ${str(m.title)}` : ''}`, tone: 'neutral' };
    case 'ANNOUNCEMENT_REMOVED':
      return { text: `${who} took down a notice`, tone: 'neutral' };
    case 'RESIDENT_REMOVED':
      return { text: `${who} removed ${them} (moved out)`, tone: 'bad' };
    case 'RESIDENT_LEFT':
      return { text: `${who} left the society`, tone: 'neutral' };
    case 'ACCOUNT_DELETED':
      return { text: 'A resident deleted their account', tone: 'neutral' };
    case 'SOS_TRIGGERED':
      return { text: `${who} pressed the emergency button${dest ? ` on a ride to ${dest}` : ''}`, tone: 'bad' };
    default: {
      const what = humanize(e.action);
      return { text: `${who}: ${what.charAt(0).toUpperCase()}${what.slice(1)}`, tone: 'neutral' };
    }
  }
}
