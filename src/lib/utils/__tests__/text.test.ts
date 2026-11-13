import { describe, it, expect } from 'vitest';
import { stripTags } from '../text';
import { CreateRideRequestSchema } from '@/lib/validation/schemas';

describe('stripTags', () => {
  it('keeps the words and drops typed tags', () => {
    expect(stripTags("B4 lobby <b>QA</b> & 'test'")).toBe("B4 lobby QA & 'test'");
    expect(stripTags('<script>alert(1)</script>Gate')).toBe('alert(1)Gate');
  });

  it('cleans place names on the way in', () => {
    const parsed = CreateRideRequestSchema.parse({ journeyId: 'jrn-1', pickupName: 'Tower <i>C</i> lobby' });
    expect(parsed.pickupName).toBe('Tower C lobby');
  });
});
