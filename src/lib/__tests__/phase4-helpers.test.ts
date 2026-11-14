import { describe, expect, it } from 'vitest';
import { profileChecklist } from '../profile-checklist';
import { groupNotifications } from '../notification-groups';

describe('profileChecklist', () => {
  it('asks a rider for a photo and work location, not a vehicle', () => {
    const items = profileChecklist({ commuteIntent: 'SEEKER' }, 0);
    expect(items.map((i) => i.id)).toEqual(['photo', 'work']);
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it('needs coordinates for the work location to count', () => {
    const named = profileChecklist({ workLocationName: 'Manyata' }, 0).find((i) => i.id === 'work');
    const placed = profileChecklist({ workLocationName: 'Manyata', workLatitude: 13, workLongitude: 77.6 }, 0).find((i) => i.id === 'work');
    expect(named?.done).toBe(false);
    expect(placed?.done).toBe(true);
  });

  it('asks residents who offer rides for a vehicle', () => {
    expect(profileChecklist({ commuteIntent: 'OFFERER' }, 0).find((i) => i.id === 'vehicle')?.done).toBe(false);
    expect(profileChecklist({ commuteIntent: 'OFFERER', profilePhotoUrl: 'data:x' }, 1).filter((i) => i.done).map((i) => i.id)).toEqual([
      'photo',
      'vehicle',
    ]);
  });
});

describe('groupNotifications', () => {
  // 14 Nov 2026, 10:00 in India
  const now = new Date('2026-11-14T04:30:00Z');

  it('splits by the India date, newest first', () => {
    const groups = groupNotifications(
      [
        { id: 'a', createdAt: '2026-11-13T19:00:00Z' }, // 14 Nov 00:30 IST: today
        { id: 'b', createdAt: '2026-11-13T18:00:00Z' }, // 13 Nov 23:30 IST: earlier
        { id: 'c', createdAt: '2026-11-14T03:00:00Z' },
      ],
      now
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['c', 'a']],
      ['Earlier', ['b']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(groupNotifications([], now)).toEqual([]);
    expect(groupNotifications([{ createdAt: '2026-11-01T00:00:00Z' }], now).map((g) => g.label)).toEqual(['Earlier']);
  });
});
