import { describe, expect, it } from 'vitest';
import { pageMembers, type MemberRow } from '../member-paging';

const row = (i: number, status: MemberRow['status'], name: string, flat: string): MemberRow =>
  ({
    id: `m${i}`,
    societyId: 's',
    userId: `u${i}`,
    flatNumber: flat,
    role: 'RESIDENT',
    status,
    createdAt: `2026-01-${String(i).padStart(2, '0')}T00:00:00Z`,
    user: { id: `u${i}`, fullName: name, mobile: `+9190000000${i}`, email: '', createdAt: '' },
  }) as unknown as MemberRow;

const all = [
  row(1, 'ACTIVE', 'Zara', 'A-10'),
  row(2, 'ACTIVE', 'amit', 'A-2'),
  row(3, 'PENDING_APPROVAL', 'Meena', 'B-1'),
  row(4, 'SUSPENDED', 'Kiran', 'C-3'),
  row(5, 'ACTIVE', 'Bala', 'A-1'),
];
const base = { filter: 'ALL' as const, sort: 'name' as const, dir: 'asc' as const, page: 1, pageSize: 2 };

describe('pageMembers', () => {
  it('pages the sorted list and reports totals and filter counts', () => {
    const p1 = pageMembers(all, base);
    expect(p1.members.map((m) => m.user.fullName)).toEqual(['amit', 'Bala']);
    expect(p1.total).toBe(5);
    expect(p1.counts).toEqual({ WAITING: 1, ACTIVE: 3, SUSPENDED: 1, ALL: 5 });
    expect(pageMembers(all, { ...base, page: 3 }).members.map((m) => m.user.fullName)).toEqual(['Zara']);
  });

  it('clamps an out-of-range page', () => {
    expect(pageMembers(all, { ...base, page: 99 }).page).toBe(3);
    expect(pageMembers(all, { ...base, page: 0 }).page).toBe(1);
  });

  it('filters by status group and searches name, flat and mobile', () => {
    expect(pageMembers(all, { ...base, filter: 'ACTIVE', pageSize: 10 }).total).toBe(3);
    expect(pageMembers(all, { ...base, filter: 'WAITING', pageSize: 10 }).members[0].user.fullName).toBe('Meena');
    expect(pageMembers(all, { ...base, q: 'kir', pageSize: 10 }).total).toBe(1);
    expect(pageMembers(all, { ...base, q: 'a-1', pageSize: 10 }).total).toBe(2);
    expect(pageMembers(all, { ...base, q: '900000003', pageSize: 10 }).members[0].user.fullName).toBe('Meena');
  });

  it('sorts flats naturally and in either direction', () => {
    const flats = pageMembers(all, { ...base, filter: 'ACTIVE', sort: 'flat', pageSize: 10 }).members.map((m) => m.flatNumber);
    expect(flats).toEqual(['A-1', 'A-2', 'A-10']);
    expect(pageMembers(all, { ...base, sort: 'joined', dir: 'desc', pageSize: 1 }).members[0].id).toBe('m5');
  });
});
