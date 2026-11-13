import { describe, it, expect } from 'vitest';
import { Feedback } from '@/types';
import { summariseReputation } from '../reputation';

const fb = (role: Feedback['role'], outcome: Feedback['outcome'], tags: string[] = []): Feedback => ({
  id: crypto.randomUUID(),
  societyId: 's',
  journeyId: 'j',
  fromUserId: 'a',
  toUserId: 'b',
  role,
  outcome,
  qualitativeTags: tags,
  createdAt: '2026-11-01T00:00:00Z',
});

describe('summariseReputation', () => {
  it('starts empty and waits for enough ratings before a percentage', () => {
    expect(summariseReputation([])).toEqual({ rides: 0, reliablePercent: null, topTags: [] });
    expect(summariseReputation([fb('SEEKER', 'COMPLETED'), fb('SEEKER', 'COMPLETED')]).reliablePercent).toBeNull();
  });

  it('counts only let-downs that were the rated person’s doing', () => {
    // Riders rating an offerer: the offerer not turning up counts; a rider's own no-show does not
    const offerer = summariseReputation([
      fb('SEEKER', 'COMPLETED', ['Punctual']),
      fb('SEEKER', 'COMPLETED', ['Punctual', 'Safe driver']),
      fb('SEEKER', 'COMPLETED'),
      fb('SEEKER', 'DRIVER_NO_SHOW'),
      fb('SEEKER', 'PASSENGER_NO_SHOW'),
    ]);
    expect(offerer).toEqual({ rides: 3, reliablePercent: 75, topTags: ['Punctual', 'Safe driver'] });
  });
});
