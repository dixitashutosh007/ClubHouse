import type { ISocietyRepository } from '@/lib/db/repository.interface';
import { notify } from '@/lib/services/push';
import type { Circle, CircleMember, CircleMemberRole, SocietyMembership, User } from '@/types';

/** What a viewer may do with a circle, worked out on the server */
export interface CircleAccess {
  member: CircleMember | null;
  /** An approved member (owner and co-admins included) */
  isMember: boolean;
  /** The owner or a co-admin */
  isCircleAdmin: boolean;
  isOwner: boolean;
  /** A society admin (or app admin) of this society: full control of every circle */
  isSocietyAdmin: boolean;
  /** May manage members and details */
  canManage: boolean;
}

export function isSocietyAdminRole(role: string): boolean {
  return role === 'SOCIETY_ADMIN' || role === 'SUPER_ADMIN';
}

export function circleAccess(member: CircleMember | null, societyRole: string): CircleAccess {
  const isMember = member?.status === 'APPROVED';
  const isCircleAdmin = isMember && (member!.role === 'OWNER' || member!.role === 'CO_ADMIN');
  const isSocietyAdmin = isSocietyAdminRole(societyRole);
  return {
    member,
    isMember,
    isCircleAdmin,
    isOwner: isMember && member!.role === 'OWNER',
    isSocietyAdmin,
    canManage: isCircleAdmin || isSocietyAdmin,
  };
}

export interface CirclePerson {
  userId: string;
  name: string;
}

export interface CircleAdminContact extends CirclePerson {
  role: Exclude<CircleMemberRole, 'MEMBER'>;
  phone?: string;
}

/** A circle as one viewer may see it */
export interface CircleView {
  id: string;
  name: string;
  type: string;
  subType?: string;
  isCustomSubType?: boolean;
  /** Used to report a circle; an ID only, never a name or number */
  ownerUserId?: string;
  description: string;
  photoUrl?: string;
  place?: string;
  schedule?: string;
  audience: Circle['audience'];
  ageMin?: number;
  ageMax?: number;
  joinMode: Circle['joinMode'];
  status: Circle['status'];
  memberCount: number;
  createdAt: string;
  /** The viewer's own place in the circle */
  viewer: {
    status: CircleMember['status'] | 'NONE';
    role?: CircleMemberRole;
    rejectionNote?: string;
    /** After a rejection: when they may ask again */
    canRequestAfter?: string;
    canManage: boolean;
    isOwner: boolean;
  };
  /** Only for approved members and society admins */
  members?: CirclePerson[];
  admins?: CircleAdminContact[];
  whatsappLink?: string;
  otherLink?: string;
  /** Only for the circle's admins and society admins */
  pendingChange?: Circle['pendingChange'];
  rejectionReason?: string;
  hasNoOwner?: boolean;
}

type People = Map<string, Pick<User, 'fullName' | 'mobile'>>;

/**
 * Builds what a viewer may see. The WhatsApp link, other link, admins'
 * phone numbers and member names go only to approved members and society
 * admins; everyone else sees the public card. Members are listed by name only.
 */
export function circleView(
  circle: Circle,
  access: CircleAccess,
  options: { members?: CircleMember[]; people?: People; cooldownDays?: number } = {}
): CircleView {
  const m = access.member;
  const view: CircleView = {
    id: circle.id,
    name: circle.name,
    type: circle.type,
    subType: circle.subType,
    isCustomSubType: circle.isCustomSubType,
    ownerUserId: circle.ownerUserId,
    description: circle.description,
    photoUrl: circle.photoUrl,
    place: circle.place,
    schedule: circle.schedule,
    audience: circle.audience,
    ageMin: circle.ageMin,
    ageMax: circle.ageMax,
    joinMode: circle.joinMode,
    status: circle.status,
    memberCount: circle.memberCount,
    createdAt: circle.createdAt,
    viewer: {
      status: m ? m.status : 'NONE',
      role: m?.status === 'APPROVED' ? m.role : undefined,
      rejectionNote: m?.status === 'REJECTED' ? m.rejectionNote : undefined,
      canRequestAfter:
        m?.status === 'REJECTED' && m.rejectedAt
          ? new Date(Date.parse(m.rejectedAt) + (options.cooldownDays ?? 3) * 86_400_000).toISOString()
          : undefined,
      canManage: access.canManage,
      isOwner: access.isOwner,
    },
  };

  if (access.isMember || access.isSocietyAdmin) {
    const approved = (options.members ?? []).filter((x) => x.status === 'APPROVED');
    const name = (id: string) => options.people?.get(id)?.fullName ?? 'Resident';
    view.whatsappLink = circle.whatsappLink;
    view.otherLink = circle.otherLink;
    view.members = approved.map((x) => ({ userId: x.userId, name: name(x.userId) })).sort((a, b) => a.name.localeCompare(b.name));
    view.admins = approved
      .filter((x) => x.role !== 'MEMBER')
      .sort((a, b) => (a.role === 'OWNER' ? -1 : b.role === 'OWNER' ? 1 : 0))
      .map((x) => ({
        userId: x.userId,
        name: name(x.userId),
        role: x.role as 'OWNER' | 'CO_ADMIN',
        phone: options.people?.get(x.userId)?.mobile,
      }));
  }
  if (access.canManage) {
    view.pendingChange = circle.pendingChange;
    view.rejectionReason = circle.rejectionReason;
    view.hasNoOwner = !circle.ownerUserId;
  } else if (m?.role === 'OWNER' || circle.createdByUserId === m?.userId) {
    view.rejectionReason = circle.rejectionReason;
  }
  return view;
}

/** Names and numbers for a set of residents */
export async function peopleFor(repo: ISocietyRepository, userIds: string[]): Promise<People> {
  const people: People = new Map();
  for (const id of [...new Set(userIds)]) {
    const u = await repo.getUserById(id);
    if (u) people.set(id, { fullName: u.fullName, mobile: u.mobile });
  }
  return people;
}

/** Keeps the member count on the circle in step with its approved members */
export async function recountMembers(repo: ISocietyRepository, circle: Circle): Promise<Circle> {
  const members = await repo.listCircleMembers(circle.societyId, circle.id);
  const memberCount = members.filter((m) => m.status === 'APPROVED').length;
  if (memberCount === circle.memberCount) return circle;
  return repo.saveCircle({ ...circle, memberCount, updatedAt: new Date().toISOString() });
}

/** The circle's owner and co-admins (approved) */
export async function circleAdminIds(repo: ISocietyRepository, circle: Circle): Promise<string[]> {
  return (await repo.listCircleMembers(circle.societyId, circle.id))
    .filter((m) => m.status === 'APPROVED' && m.role !== 'MEMBER')
    .map((m) => m.userId);
}

/** The society's admins (who approve circles) */
export async function societyAdminIds(repo: ISocietyRepository, societyId: string): Promise<string[]> {
  return (await repo.listSocietyMembers(societyId))
    .filter((m: SocietyMembership) => m.status === 'ACTIVE' && isSocietyAdminRole(m.role))
    .map((m) => m.userId);
}

/** In-app (and push) notices about a circle */
export async function notifyCircle(
  repo: ISocietyRepository,
  societyId: string,
  userIds: string[],
  title: string,
  body: string,
  link: string,
  exceptUserId?: string
): Promise<void> {
  const now = new Date().toISOString();
  for (const userId of [...new Set(userIds)]) {
    if (userId === exceptUserId) continue;
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId,
      userId,
      title,
      body,
      type: 'CIRCLE',
      link,
      read: false,
      createdAt: now,
    });
  }
}

/**
 * A resident leaves the society (moved out, removed or deleted their
 * account): they leave every circle. A circle they owned passes to its
 * longest-serving co-admin; with none, the society admins are told to pick
 * a new owner.
 */
export async function leaveAllCircles(repo: ISocietyRepository, societyId: string, userId: string): Promise<void> {
  const memberships = await repo.listUserCircleMemberships(societyId, userId);
  for (const membership of memberships) {
    const circle = await repo.getCircle(societyId, membership.circleId);
    await repo.deleteCircleMember(societyId, membership.circleId, userId);
    if (!circle) continue;
    let updated = circle;
    if (membership.role === 'OWNER' && membership.status === 'APPROVED') {
      const next = (await repo.listCircleMembers(societyId, circle.id))
        .filter((m) => m.status === 'APPROVED' && m.role === 'CO_ADMIN')
        .sort((a, b) => (a.approvedAt ?? a.requestedAt).localeCompare(b.approvedAt ?? b.requestedAt))[0];
      if (next) {
        await repo.saveCircleMember({ ...next, role: 'OWNER' });
        updated = await repo.saveCircle({ ...circle, ownerUserId: next.userId, updatedAt: new Date().toISOString() });
        await notifyCircle(
          repo,
          societyId,
          [next.userId],
          `You now own ${circle.name}`,
          'The previous owner left the society, so the circle passed to you.',
          `/circles/${circle.id}`
        );
      } else {
        updated = await repo.saveCircle({ ...circle, ownerUserId: undefined, updatedAt: new Date().toISOString() });
        if (circle.status === 'ACTIVE' || circle.status === 'PENDING_APPROVAL') {
          await notifyCircle(
            repo,
            societyId,
            await societyAdminIds(repo, societyId),
            `${circle.name} needs a new owner`,
            'Its owner left the society and it has no co-admin. Choose a member as the new owner, or close the circle.',
            `/circles/${circle.id}`
          );
        }
      }
    }
    await recountMembers(repo, updated);
  }
}
