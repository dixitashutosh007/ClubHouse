import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetRepository } from '@/test/route-helpers';
import { rateLimit } from '../rate-limit';
import { MockDynamoRepository } from '@/lib/db/mock-repository';

describe('rateLimit (shared store)', () => {
  let repo: MockDynamoRepository;
  beforeEach(() => {
    repo = resetRepository();
  });

  it('allows up to the limit in a window, then blocks with a retry time', async () => {
    for (let i = 0; i < 3; i++) expect((await rateLimit('k', 3, 60_000)).allowed).toBe(true);
    const blocked = await rateLimit('k', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await rateLimit('other', 3, 60_000)).allowed).toBe(true);
  });

  it('lets requests through if the store fails, rather than locking residents out', async () => {
    vi.spyOn(repo, 'hitRateLimit').mockRejectedValue(new Error('database down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await rateLimit('k', 1, 60_000)).allowed).toBe(true);
  });
});
