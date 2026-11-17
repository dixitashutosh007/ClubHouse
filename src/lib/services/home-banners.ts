import type { ISocietyRepository } from '@/lib/db/repository.interface';
import type { AdminPermissions, MembershipRole } from '@/types';
import { formatIstTime, istDateOf, istDateString, relativeDayLabel } from '@/lib/utils/time';

/** How long "new" circles, classes and circle approvals stay on Home */
export const BANNER_NEW_DAYS = 3;
/** At most this many banners in the row */
export const MAX_BANNERS = 12;

export type BannerKind = 'SEAT_ACCEPTED' | 'RIDE_REQUESTS' | 'ADMIN_APPROVALS' | 'CIRCLE_JOINED' | 'NOTICE' | 'NEW_CIRCLE' | 'NEW_CLASS';

export interface HomeBanner {
  /**
   * Stable id used to dismiss it. Count banners include the newest item, so a
   * new request or approval brings a dismissed banner back.
   */
  id: string;
  kind: BannerKind;
  /** Module colour */
  tone: 'home' | 'ride' | 'classes' | 'community';
  title: string;
  body?: string;
  /** Where tapping goes; notices open in place instead */
  href?: string;
  noticeId?: string;
  createdAt: string;
}

/** Order on Home: things that need you first, then news */
const PRIORITY: BannerKind[] = ['SEAT_ACCEPTED', 'RIDE_REQUESTS', 'ADMIN_APPROVALS', 'CIRCLE_JOINED', 'NOTICE', 'NEW_CIRCLE', 'NEW_CLASS'];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const excerpt = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const UNFINISHED_RIDES = ['OPEN', 'PARTIALLY_BOOKED', 'FULL'];

export interface BannerViewer {
  societyId: string;
  userId: string;
  role: MembershipRole;
  permissions?: AdminPermissions;
}

const can = (v: BannerViewer, p: keyof AdminPermissions) =>
  v.role === 'SUPER_ADMIN' || (v.role === 'SOCIETY_ADMIN' && v.permissions?.[p] !== false);

/**
 * Everything worth a banner on this resident's Home, minus the ones they
 * dismissed. Only data the resident may already see is used.
 */
export async function buildHomeBanners(repo: ISocietyRepository, v: BannerViewer, now = Date.now()): Promise<HomeBanner[]> {
  const { societyId, userId } = v;
  const since = new Date(now - BANNER_NEW_DAYS * 86_400_000).toISOString();
  const nowIso = new Date(now).toISOString();
  const isSocietyAdmin = v.role === 'SOCIETY_ADMIN' || v.role === 'SUPER_ADMIN';
  const banners: HomeBanner[] = [];

  const [dismissed, myRequests, myRides, notices, circles, myCircleMemberships, classes] = await Promise.all([
    repo.getBannerDismissals(societyId, userId),
    repo.listUserRequests(societyId, userId),
    repo.listUserRides(societyId, userId),
    repo.listAnnouncements(societyId),
    repo.listCircles(societyId),
    repo.listUserCircleMemberships(societyId, userId),
    repo.listActiveClasses(societyId),
  ]);

  // Your seat request was accepted (for a ride still to come)
  for (const r of myRequests) {
    if (r.status !== 'ACCEPTED' || r.riderEndedAt || r.updatedAt < since) continue;
    const ride = await repo.getRideOccurrence(societyId, r.journeyId);
    if (!ride || !UNFINISHED_RIDES.includes(ride.status) || ride.departureWindowStart < nowIso) continue;
    const offerer = await repo.getUserById(ride.offererUserId);
    const when = `${relativeDayLabel(istDateOf(ride.departureWindowStart), new Date(now))} ${formatIstTime(ride.departureWindowStart)}`;
    banners.push({
      id: `seat:${r.id}`,
      kind: 'SEAT_ACCEPTED',
      tone: 'ride',
      title: 'Your seat is confirmed',
      body: `${offerer?.fullName ?? 'Your neighbour'} · ${when} to ${ride.destinationName}`,
      href: '/rides/my-requests',
      createdAt: r.updatedAt,
    });
  }

  // Your own seat requests still waiting for the offerer's answer
  const asked: typeof myRequests = [];
  for (const r of myRequests) {
    if (r.status !== 'REQUESTED') continue;
    const ride = await repo.getRideOccurrence(societyId, r.journeyId);
    if (ride && UNFINISHED_RIDES.includes(ride.status) && ride.departureWindowStart >= nowIso) asked.push(r);
  }
  if (asked.length) {
    const newest = asked.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    banners.push({
      id: `my-requests:${newest.id}:${asked.length}`,
      kind: 'RIDE_REQUESTS',
      tone: 'ride',
      title: `${plural(asked.length, 'ride request')} awaiting a reply`,
      body: 'You will be told as soon as the offerer answers.',
      href: '/rides/my-requests',
      createdAt: newest.createdAt,
    });
  }

  // Seat requests waiting for your answer, on rides you offer
  const upcomingRides = myRides.filter((r) => UNFINISHED_RIDES.includes(r.status) && r.departureWindowStart >= nowIso);
  const waiting = (await Promise.all(upcomingRides.map((r) => repo.listJourneyRequests(societyId, r.id))))
    .flat()
    .filter((q) => q.status === 'REQUESTED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (waiting.length) {
    banners.push({
      id: `ride-requests:${waiting[0].id}`,
      kind: 'RIDE_REQUESTS',
      tone: 'ride',
      title: `${plural(waiting.length, 'seat request')} to answer`,
      body: 'Neighbours are waiting to hear about your ride.',
      href: '/rides/requests',
      createdAt: waiting[0].createdAt,
    });
  }

  // Approvals, for admins with the right permission
  if (can(v, 'canApproveResidents')) {
    const pending = (await repo.listPendingMemberships(societyId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (pending.length) {
      banners.push({
        id: `admin-residents:${pending[0].userId}:${pending.length}`,
        kind: 'ADMIN_APPROVALS',
        tone: 'home',
        title: `${plural(pending.length, 'resident')} waiting for approval`,
        href: '/admin?tab=MEMBERS',
        createdAt: pending[0].createdAt,
      });
    }
  }
  if (can(v, 'canApproveClasses')) {
    const pending = (await repo.listPendingClasses(societyId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (pending.length) {
      banners.push({
        id: `admin-classes:${pending[0].id}:${pending.length}`,
        kind: 'ADMIN_APPROVALS',
        tone: 'classes',
        title: `${plural(pending.length, 'class', 'classes')} waiting for approval`,
        href: '/admin?tab=LESSONS',
        createdAt: pending[0].createdAt,
      });
    }
  }
  if (isSocietyAdmin) {
    const pending = circles
      .filter((c) => c.status === 'PENDING_APPROVAL' || (c.status === 'ACTIVE' && c.pendingChange))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (pending.length) {
      banners.push({
        id: `admin-circles:${pending[0].id}:${pending[0].updatedAt}:${pending.length}`,
        kind: 'ADMIN_APPROVALS',
        tone: 'community',
        title: `${plural(pending.length, 'circle')} waiting for approval`,
        body: 'New circles and changes to live ones.',
        href: '/admin?tab=CIRCLES',
        createdAt: pending[0].updatedAt,
      });
    }
  }

  // You were approved to join a circle (not circles you started)
  const byId = new Map(circles.map((c) => [c.id, c]));
  const mine = new Set(myCircleMemberships.map((m) => m.circleId));
  for (const m of myCircleMemberships) {
    const c = byId.get(m.circleId);
    if (!c || c.status !== 'ACTIVE' || m.status !== 'APPROVED' || !m.approvedAt || m.approvedAt < since) continue;
    if (c.createdByUserId === userId || m.role === 'OWNER') continue;
    banners.push({
      id: `circle-joined:${c.id}`,
      kind: 'CIRCLE_JOINED',
      tone: 'community',
      title: `You're in ${c.name}`,
      body: 'See the members, the group link and messages.',
      href: `/circles/${c.id}`,
      createdAt: m.approvedAt,
    });
  }

  // Society notices still running
  const today = istDateString(new Date(now));
  for (const n of notices) {
    if (n.expiresOn && n.expiresOn < today) continue;
    banners.push({
      id: `notice:${n.id}`,
      kind: 'NOTICE',
      tone: 'home',
      title: n.title,
      body: excerpt(n.body),
      noticeId: n.id,
      createdAt: n.createdAt,
    });
  }

  // New circles in their first 3 days (ones you're not already in)
  for (const c of circles) {
    const live = c.approvedAt ?? c.createdAt;
    if (c.status !== 'ACTIVE' || live < since || mine.has(c.id) || c.createdByUserId === userId) continue;
    banners.push({
      id: `new-circle:${c.id}`,
      kind: 'NEW_CIRCLE',
      tone: 'community',
      title: `New circle: ${c.name}`,
      body: c.subType ? `${c.type} · ${c.subType}` : c.type,
      href: `/circles/${c.id}`,
      createdAt: live,
    });
  }

  // New classes in their first 3 days (not your own)
  for (const cls of classes) {
    const live = cls.approvedAt ?? cls.createdAt;
    if (live < since || cls.createdByUserId === userId) continue;
    banners.push({
      id: `new-class:${cls.id}`,
      kind: 'NEW_CLASS',
      tone: 'classes',
      title: `New class: ${cls.subject}`,
      body: cls.contactName ? `With ${cls.contactName}` : undefined,
      href: '/lessons',
      createdAt: live,
    });
  }

  const hidden = new Set(dismissed);
  return banners
    .filter((b) => !hidden.has(b.id))
    .sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_BANNERS);
}
