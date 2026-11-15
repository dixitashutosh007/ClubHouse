import type { MembershipStatus, SocietyMembership, User } from '@/types';

export type MemberRow = SocietyMembership & { user: User };
export type MemberFilter = 'WAITING' | 'ACTIVE' | 'SUSPENDED' | 'ALL';
export type MemberSort = 'name' | 'flat' | 'status' | 'joined';

/** Which statuses each resident filter shows (the same groups as the admin screen) */
export const MEMBER_FILTERS: Record<MemberFilter, (m: MemberRow) => boolean> = {
  WAITING: (m) => m.status === 'PENDING_APPROVAL' || m.status === 'REGISTERED',
  ACTIVE: (m) => m.status === 'ACTIVE',
  SUSPENDED: (m) => ['SUSPENDED', 'REJECTED', 'DEACTIVATED'].includes(m.status),
  ALL: () => true,
};

const STATUS_ORDER: Record<MembershipStatus, number> = {
  PENDING_APPROVAL: 0,
  REGISTERED: 0,
  ACTIVE: 1,
  INVITED: 2,
  SUSPENDED: 3,
  REJECTED: 4,
  DEACTIVATED: 5,
};

export interface MemberPageQuery {
  filter: MemberFilter;
  q?: string;
  sort: MemberSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface MemberPage {
  members: MemberRow[];
  /** Rows matching the filter and search, before paging */
  total: number;
  page: number;
  pageSize: number;
  /** How many residents each filter holds (ignoring the search) */
  counts: Record<MemberFilter, number>;
}

/** One page of a society's residents: filtered, searched (name, flat, mobile) and sorted */
export function pageMembers(all: MemberRow[], query: MemberPageQuery): MemberPage {
  const q = query.q?.trim().toLowerCase() ?? '';
  const matching = all
    .filter(MEMBER_FILTERS[query.filter])
    .filter((m) => !q || m.user.fullName.toLowerCase().includes(q) || (m.flatNumber ?? '').toLowerCase().includes(q) || (m.user.mobile ?? '').includes(q));
  const key = (m: MemberRow): string | number =>
    query.sort === 'flat' ? (m.flatNumber ?? '') : query.sort === 'status' ? STATUS_ORDER[m.status] : query.sort === 'joined' ? m.createdAt : m.user.fullName.toLowerCase();
  const sorted = [...matching].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true });
    return query.dir === 'asc' ? r : -r;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pages);
  return {
    members: sorted.slice((page - 1) * query.pageSize, page * query.pageSize),
    total: sorted.length,
    page,
    pageSize: query.pageSize,
    counts: {
      WAITING: all.filter(MEMBER_FILTERS.WAITING).length,
      ACTIVE: all.filter(MEMBER_FILTERS.ACTIVE).length,
      SUSPENDED: all.filter(MEMBER_FILTERS.SUSPENDED).length,
      ALL: all.length,
    },
  };
}
