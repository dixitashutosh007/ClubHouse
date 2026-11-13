import { ISocietyRepository } from '@/lib/db/repository.interface';
import { Feedback, JourneyOutcome, Reputation } from '@/types';

export type { Reputation };

/** Ratings needed before a reliability percentage is shown */
export const MIN_RATINGS_FOR_PERCENT = 3;

/** Outcomes that count against the person being rated, by the rater's role */
const LET_DOWN: Record<Feedback['role'], JourneyOutcome[]> = {
  // A rider rating the offerer
  SEEKER: ['DRIVER_NO_SHOW', 'DRIVER_CANCELLED'],
  // An offerer rating a rider
  OFFERER: ['PASSENGER_NO_SHOW', 'PASSENGER_CANCELLED'],
};

export function summariseReputation(received: Feedback[]): Reputation {
  const rides = received.filter((f) => f.outcome === 'COMPLETED').length;
  const letDowns = received.filter((f) => LET_DOWN[f.role].includes(f.outcome)).length;
  const rated = rides + letDowns;

  const tagCounts = new Map<string, number>();
  for (const f of received) for (const tag of f.qualitativeTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([tag]) => tag);

  return {
    rides,
    reliablePercent: rated >= MIN_RATINGS_FOR_PERCENT ? Math.round((rides / rated) * 100) : null,
    topTags,
  };
}

/** Reputation of several residents at once */
export async function reputationsFor(
  repo: ISocietyRepository,
  societyId: string,
  userIds: string[]
): Promise<Map<string, Reputation>> {
  const unique = [...new Set(userIds)];
  const entries = await Promise.all(
    unique.map(async (id) => [id, summariseReputation(await repo.listUserFeedbackReceived(societyId, id))] as const)
  );
  return new Map(entries);
}
