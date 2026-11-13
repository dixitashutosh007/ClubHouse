import { AuditEvent, ModerationReport, SocietyMembership, User } from '@/types';

/** A membership row as returned by GET /api/v1/admin/residents */
export type AdminMember = SocietyMembership & { user: User };

export type AuditLogEntry = AuditEvent & { actorName: string; subjectName?: string };

export type { ModerationReport };

/** Shows a status message at the top of the admin portal */
export type Notify = (text: string, kind?: 'success' | 'error') => void;
