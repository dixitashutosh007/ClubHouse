import { ISocietyRepository } from '@/lib/db/repository.interface';
import { notify } from '@/lib/services/push';
import { rideMessages } from '@/lib/services/ride-messages';
import { UNFINISHED_STATUSES } from '@/lib/services/ride-lifecycle';
import { formatIstDay } from '@/lib/utils/time';

/**
 * Leaving a society (moving out, removal by an admin, or account deletion):
 * the resident's open rides are cancelled with their riders told, their seat
 * requests are withdrawn, repeating rides and classes stop, and their
 * membership is closed. Past rides stay for others' history.
 */
export async function leaveSociety(
  repo: ISocietyRepository,
  societyId: string,
  userId: string,
  opts: { actorUserId: string; reason: 'MOVED_OUT' | 'REMOVED_BY_ADMIN' | 'ACCOUNT_DELETED' }
): Promise<{ ridesCancelled: number; requestsWithdrawn: number; classesStopped: number }> {
  const now = new Date().toISOString();
  const user = await repo.getUserById(userId);
  const name = user?.fullName ?? '';

  // Rides they offer that haven't happened yet
  let ridesCancelled = 0;
  for (const ride of await repo.listUserRides(societyId, userId)) {
    if (!UNFINISHED_STATUSES.includes(ride.status) || ride.status === 'IN_PROGRESS') continue;
    const result = await repo.cancelRideWithRequests(societyId, ride.id, userId, 'The resident left the society');
    if (!result.ok) continue;
    ridesCancelled++;
    const text = rideMessages.rideCancelled(name, ride.destinationName, formatIstDay(ride.journeyDate));
    for (const request of result.affectedRequests) {
      await notify(repo, {
        id: `notif-${crypto.randomUUID()}`,
        societyId,
        userId: request.seekerUserId,
        ...text,
        type: 'RIDE_CANCELLED',
        link: '/rides/find',
        read: false,
        createdAt: now,
      });
    }
  }

  // Seats they asked for or hold on others' rides
  let requestsWithdrawn = 0;
  for (const request of await repo.listUserRequests(societyId, userId)) {
    if (request.status !== 'REQUESTED' && request.status !== 'ACCEPTED') continue;
    const result = await repo.closeRideRequest(societyId, request.id, { userId, as: 'SEEKER' });
    if (!result.ok) continue;
    requestsWithdrawn++;
    if (result.previousStatus === 'ACCEPTED') {
      await notify(repo, {
        id: `notif-${crypto.randomUUID()}`,
        societyId,
        userId: result.journey.offererUserId,
        ...rideMessages.seekerCancelled(name, request.requestedSeats, result.journey.destinationName),
        type: 'RIDE_CANCELLED',
        link: '/rides/my-rides',
        read: false,
        createdAt: now,
      });
    }
  }

  for (const schedule of await repo.listUserSchedules(societyId, userId)) {
    await repo.deactivateSchedule(societyId, schedule.id, userId);
  }

  let classesStopped = 0;
  for (const listing of await repo.listUserClasses(societyId, userId)) {
    if (listing.status === 'DEACTIVATED' || listing.status === 'REJECTED' || listing.status === 'EXPIRED') continue;
    await repo.updateClassStatus(societyId, listing.id, 'DEACTIVATED', opts.actorUserId, 'The teacher left the society');
    classesStopped++;
  }

  for (const vehicle of await repo.listUserVehicles(societyId, userId)) {
    await repo.updateVehicle(societyId, vehicle.id, { isActive: false });
  }

  if (await repo.getMembership(societyId, userId)) {
    await repo.updateMembership(societyId, userId, { status: 'DEACTIVATED', role: 'RESIDENT', permissions: undefined });
  }

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId,
    actorUserId: opts.actorUserId,
    action: opts.reason === 'REMOVED_BY_ADMIN' ? 'RESIDENT_REMOVED' : opts.reason === 'MOVED_OUT' ? 'RESIDENT_LEFT' : 'ACCOUNT_DELETED',
    entityType: 'MEMBERSHIP',
    entityId: userId,
    metadata: { targetUserId: userId, ridesCancelled, requestsWithdrawn, classesStopped },
    createdAt: now,
  });

  return { ridesCancelled, requestsWithdrawn, classesStopped };
}

/**
 * Deletes a resident's account: leaves every society, erases personal
 * details (name, mobile, email, work location, number plates, photo) and
 * push devices, and marks the account deleted so it can never sign in.
 * Past rides keep only an anonymous "Former resident".
 */
export async function deleteAccount(repo: ISocietyRepository, userId: string): Promise<void> {
  const memberships = await repo.listUserMemberships(userId);
  for (const m of memberships) {
    if (m.status !== 'DEACTIVATED') {
      await leaveSociety(repo, m.societyId, userId, { actorUserId: userId, reason: 'ACCOUNT_DELETED' });
    }
    await repo.updateMembership(m.societyId, userId, { flatNumber: 'Removed', status: 'DEACTIVATED' });
    for (const vehicle of await repo.listUserVehicles(m.societyId, userId, true)) {
      await repo.updateVehicle(m.societyId, vehicle.id, { registrationNumber: 'Removed', isActive: false });
    }
  }

  for (const device of await repo.listPushDevices(userId)) {
    await repo.deletePushDevice(device.id);
  }

  const now = new Date().toISOString();
  await repo.updateUser(userId, {
    fullName: 'Former resident',
    email: '',
    mobile: '',
    firebaseUid: undefined,
    workLocationName: undefined,
    workLatitude: undefined,
    workLongitude: undefined,
    profilePhotoUrl: undefined,
    gender: 'PREFER_NOT_TO_SAY',
    commuteIntent: undefined,
    emailVerified: false,
    profileCompleted: false,
    deletedAt: now,
  });
}
