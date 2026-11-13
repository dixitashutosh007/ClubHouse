import { ISocietyRepository } from '@/lib/db/repository.interface';

/**
 * Residents whose rides and requests this user must not see: those they have
 * hidden, and those who have hidden them. Hiding works both ways so neither
 * side can reach the other through RideShare.
 */
export async function hiddenFrom(repo: ISocietyRepository, societyId: string, userId: string): Promise<Set<string>> {
  const members = await repo.listSocietyMembers(societyId);
  const hidden = new Set<string>();
  for (const m of members) {
    if (m.userId === userId) for (const id of m.hiddenUserIds ?? []) hidden.add(id);
    else if (m.hiddenUserIds?.includes(userId)) hidden.add(m.userId);
  }
  return hidden;
}
