import { describe, it, expect } from 'vitest';
import { firstName, homeSummary } from '../home-data';
import type { UpcomingRide } from '@/hooks/useMyUpcomingRides';
import type { ClassListing } from '@/types';

const ride = (key: string, confirmed: boolean): UpcomingRide => ({
  key,
  when: '2026-11-14T08:00:00+05:30',
  title: 'To Manyata Tech Park',
  detail: 'Riding with Ashutosh D.',
  href: '/rides/my-requests',
  role: 'JOINING',
  confirmed,
  statusLabel: confirmed ? 'Joining' : 'Requested',
});

const cls = (id: string, createdAt: string) => ({ id, createdAt, subject: id }) as ClassListing;

describe('home summary', () => {
  it('shows nothing it does not have', () => {
    const s = homeSummary([], []);
    expect(s).toEqual({ nextRide: null, rideDetail: undefined, classDetail: undefined, newClasses: [] });
  });

  it('picks the first confirmed ride, not a pending request', () => {
    const s = homeSummary([ride('a', false), ride('b', true)], []);
    expect(s.nextRide?.key).toBe('b');
    expect(s.rideDetail).toBe('2 upcoming rides');
  });

  it('counts live classes and lists the three newest', () => {
    const s = homeSummary([], [cls('old', '2026-11-01'), cls('new', '2026-11-12'), cls('mid', '2026-11-05'), cls('x', '2026-10-01')]);
    expect(s.classDetail).toBe('4 classes live');
    expect(s.newClasses.map((c) => c.id)).toEqual(['new', 'mid', 'old']);
    expect(homeSummary([], [cls('one', '2026-11-01')]).classDetail).toBe('1 class live');
  });

  it('greets by first name, never by the onboarding placeholder', () => {
    expect(firstName('Rohan Gupta')).toBe('Rohan');
    expect(firstName('Resident Member')).toBe('');
    expect(firstName(undefined)).toBe('');
  });
});
