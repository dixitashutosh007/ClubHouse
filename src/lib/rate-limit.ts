import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';

/**
 * Fixed-window rate limiter shared by every server instance: counts live in
 * the database (Firestore in production), so limits hold when the host runs
 * several copies of the app. Firebase also rate-limits SMS sends.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    const { count, resetAt } = await getRepository().hitRateLimit(key, windowMs, now);
    return count > limit
      ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) }
      : { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    // A database hiccup must not lock everyone out; the limit is a brake, not a gate
    console.error('Rate limit check failed', err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Test-only: counters live in the repository, which tests replace with a
 * fresh one (resetRepository), so there is nothing else to clear.
 */
export function resetRateLimits(): void {}
