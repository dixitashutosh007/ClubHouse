import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/api-auth';
import { formatPublicJourneyView } from '@/lib/services/privacy';
import { RideOccurrence, RideSchedule } from '@/types';
import {
  CancelRideQuerySchema,
  CreateRideSchema,
  RideLifecycleSchema,
  ListRidesQuerySchema,
  UpdateRideSchema,
} from '@/lib/validation/schemas';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { validateDepartureWindow } from '@/lib/services/ride-rules';
import { journeyStatusForSeats } from '@/lib/services/seat-booking';
import { rideMessages } from '@/lib/services/ride-messages';
import { formatIstDay, istTimeHHMM } from '@/lib/utils/time';
import { buildOccurrence, fillSchedule, fillSocietySchedules, RidePlan } from '@/lib/services/ride-schedules';
import { completeBlocker, settleStaleRides, startBlocker } from '@/lib/services/ride-lifecycle';
import { notify } from '@/lib/services/push';
import { hiddenFrom } from '@/lib/services/hidden-residents';
import { reputationsFor } from '@/lib/services/reputation';
import { clashResponse, findRideClash } from '@/lib/services/ride-clash';

// List available rides or user's rides
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ListRidesQuerySchema);
  if (query instanceof NextResponse) return query;
  const date = query.date;
  const myRidesOnly = query.mine === 'true';

  const repo = getRepository();
  // Keep the society's rides current: finish old ones, add the coming week's repeating ones
  await settleStaleRides(repo, auth.societyId);
  await fillSocietySchedules(repo, auth.societyId);

  if (myRidesOnly) {
    const userRides = await repo.listUserRides(auth.societyId, auth.userId);
    return NextResponse.json({ rides: userRides });
  }

  // Anonymize and format privacy views
  const userRequests = await repo.listUserRequests(auth.societyId, auth.userId);
  const fuelPrice = (await repo.getSocietyById(auth.societyId))?.settings.fuelPricePerLitre;
  const requestMap = new Map(userRequests.map((r) => [r.journeyId, r.status]));

  // Open society rides (today + upcoming). Rides that have already left can
  // no longer be requested, so only their offerer and accepted riders see them.
  const now = Date.now();
  const hidden = await hiddenFrom(repo, auth.societyId, auth.userId);
  const openRides = (await repo.listOpenRides(auth.societyId, date)).filter(
    (ride) =>
      (!hidden.has(ride.offererUserId) && Date.parse(ride.departureWindowStart) > now) ||
      ride.offererUserId === auth.userId ||
      requestMap.get(ride.id) === 'ACCEPTED'
  );

  const reputation = await reputationsFor(
    repo,
    auth.societyId,
    openRides.map((r) => r.offererUserId)
  );
  const publicViews = await Promise.all(
    openRides.map(async (ride) => {
      const offerer = await repo.getUserById(ride.offererUserId);
      const vehicle = await repo.getVehicleById(auth.societyId, ride.vehicleId);
      if (!offerer || !vehicle) return null;

      const seekerRequestStatus = requestMap.get(ride.id);
      const isAccepted = ride.offererUserId === auth.userId || seekerRequestStatus === 'ACCEPTED';
      let offererFlatNumber: string | undefined;
      if (isAccepted) {
        const mem = await repo.getMembership(auth.societyId, ride.offererUserId);
        if (mem?.flatNumber) offererFlatNumber = mem.flatNumber;
      }

      return {
        ...formatPublicJourneyView(
          ride,
          offerer,
          vehicle,
          { isOfferer: ride.offererUserId === auth.userId, seekerRequestStatus, offererFlatNumber },
          fuelPrice
        ),
        offererReputation: reputation.get(ride.offererUserId),
      };
    })
  );

  return NextResponse.json({
    rides: publicViews.filter(Boolean),
  });
}

// Offer a ride / create a ride occurrence
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateRideSchema);
  if (body instanceof NextResponse) return body;

  const {
    vehicleId,
    journeyDate,
    departureWindowStart,
    departureWindowEnd,
    direction,
    originName,
    originLat,
    originLng,
    meetingPoint,
    destinationName,
    destinationPlaceId,
    destinationLat,
    destinationLng,
    totalSeats,
    genderPreference,
    visibility,
    repeatDays,
    allowClash,
  } = body;

  const windowEnd = departureWindowEnd || departureWindowStart;
  const windowError = validateDepartureWindow(journeyDate, departureWindowStart, departureWindowEnd);
  if (windowError) return errorResponse(windowError);

  const repo = getRepository();

  // Verify vehicle belongs to user in this society
  const vehicle = await repo.getVehicleById(auth.societyId, vehicleId);
  if (!vehicle || vehicle.userId !== auth.userId) {
    return errorResponse('Invalid vehicle selected');
  }
  if (totalSeats > vehicle.capacity) {
    return errorResponse(`This vehicle has room for at most ${vehicle.capacity} passenger(s)`);
  }

  const society = await repo.getSocietyById(auth.societyId);
  if (!society) return errorResponse('Society not found', 404);

  // Rides start at the society unless the offerer picked another origin
  const plan: RidePlan = {
    societyId: auth.societyId,
    offererUserId: auth.userId,
    vehicleId,
    direction: direction || 'OUTBOUND_SOCIETY',
    originName: originName || society.name,
    originLat: originLat ?? society.latitude,
    originLng: originLng ?? society.longitude,
    meetingPoint: meetingPoint || undefined,
    destinationName,
    destinationPlaceId,
    destinationLat,
    destinationLng,
    totalSeats,
    // Gender-restricted rides only where the society allows them
    genderPreference: society.settings.allow_gender_preferences ? genderPreference : 'ANY',
    visibility: visibility || 'SOCIETY_WIDE',
  };

  // A repeating ride: save the weekly plan and create the coming week's rides from it
  if (repeatDays?.length) {
    const schedule: RideSchedule = {
      id: `sch-${crypto.randomUUID()}`,
      userId: auth.userId,
      ...plan,
      departureWindowStart: istTimeHHMM(departureWindowStart),
      departureWindowEnd: istTimeHHMM(windowEnd),
      recurrenceDays: [...new Set(repeatDays)].sort(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await repo.createRideSchedule(schedule);
    const rides = await fillSchedule(repo, schedule);

    await repo.recordAuditEvent({
      id: `audit-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      actorUserId: auth.userId,
      action: 'RIDE_SCHEDULE_CREATED',
      entityType: 'RIDE_SCHEDULE',
      entityId: schedule.id,
      metadata: { days: schedule.recurrenceDays, destinationName, seats: totalSeats },
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, ride: rides[0] ?? null, schedule, ridesCreated: rides.length });
  }

  const occurrence = buildOccurrence(plan, journeyDate, departureWindowStart, windowEnd);
  if (!allowClash) {
    const clash = await findRideClash(repo, auth.societyId, auth.userId, occurrence);
    if (clash) return clashResponse(clash);
  }
  const saved = await repo.createRideOccurrence(occurrence);

  // Record audit
  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'RIDE_OFFERED',
    entityType: 'RIDE_OCCURRENCE',
    entityId: saved.id,
    metadata: { journeyDate, destinationName, seats: totalSeats },
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, ride: saved });
}

// Edit a ride occurrence (Offerer only)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, UpdateRideSchema);
  if (body instanceof NextResponse) return body;
  const {
    journeyId,
    destinationName,
    destinationPlaceId,
    destinationLat,
    destinationLng,
    meetingPoint,
    departureWindowStart,
    departureWindowEnd,
    totalSeats,
    genderPreference,
  } = body;

  const repo = getRepository();
  const existing = await repo.getRideOccurrence(auth.societyId, journeyId);
  if (!existing) return errorResponse('Ride not found', 404);
  if (existing.offererUserId !== auth.userId) return errorResponse('Unauthorized to edit this ride', 403);
  if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED' || existing.status === 'EXPIRED') {
    return errorResponse('This ride can no longer be edited', 409);
  }

  const newStart = departureWindowStart ?? existing.departureWindowStart;
  const newEnd = departureWindowEnd ?? existing.departureWindowEnd;
  if (departureWindowStart || departureWindowEnd) {
    const windowError = validateDepartureWindow(existing.journeyDate, newStart, newEnd);
    if (windowError) return errorResponse(windowError);
  }

  const updates: Partial<RideOccurrence> = {};
  if (destinationName) updates.destinationName = destinationName;
  // A new destination moves where the ride goes, so matching follows it
  if (destinationLat !== undefined && destinationLng !== undefined) {
    updates.destinationLat = destinationLat;
    updates.destinationLng = destinationLng;
    updates.destinationPlaceId = destinationPlaceId;
  }
  if (meetingPoint !== undefined) updates.meetingPoint = meetingPoint || undefined;
  if (departureWindowStart) updates.departureWindowStart = departureWindowStart;
  if (departureWindowEnd) updates.departureWindowEnd = departureWindowEnd;
  if (genderPreference) updates.genderPreference = genderPreference;
  if (totalSeats) {
    const bookedSeats = existing.totalSeats - existing.availableSeats;
    if (totalSeats < bookedSeats) {
      return errorResponse(`${bookedSeats} seat(s) are already booked on this ride`);
    }
    updates.totalSeats = totalSeats;
    updates.availableSeats = totalSeats - bookedSeats;
    updates.status = journeyStatusForSeats(updates.availableSeats);
  }

  const updated = await repo.updateRideOccurrence(auth.societyId, journeyId, auth.userId, updates);

  return NextResponse.json({ success: true, ride: updated });
}

// Cancel a ride occurrence (Offerer only). The ride is kept for history;
// everyone with a pending or accepted request is notified.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, CancelRideQuerySchema);
  if (query instanceof NextResponse) return query;
  const { journeyId, reason = 'Cancelled by the offerer' } = query;

  const repo = getRepository();
  const result = await repo.cancelRideWithRequests(auth.societyId, journeyId, auth.userId, reason);
  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') return errorResponse('Ride not found', 404);
    if (result.reason === 'FORBIDDEN') return errorResponse('Unauthorized to cancel this ride', 403);
    return errorResponse('This ride has already been cancelled or completed', 409);
  }

  const now = new Date().toISOString();
  const offerer = await repo.getUserById(auth.userId);
  const cancelledText = rideMessages.rideCancelled(
    offerer?.fullName ?? '',
    result.journey.destinationName,
    formatIstDay(result.journey.journeyDate)
  );
  for (const request of result.affectedRequests) {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: request.seekerUserId,
      ...cancelledText,
      type: 'RIDE_CANCELLED',
      link: '/rides/find',
      read: false,
      createdAt: now,
    });
  }

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'RIDE_CANCELLED',
    entityType: 'RIDE_OCCURRENCE',
    entityId: journeyId,
    metadata: { reason, notifiedSeekers: result.affectedRequests.length },
    createdAt: now,
  });

  return NextResponse.json({
    success: true,
    message: 'Ride cancelled',
    ride: result.journey,
    notifiedSeekers: result.affectedRequests.length,
  });
}

// The offerer starts the ride (sets off) or marks it complete
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, RideLifecycleSchema);
  if (body instanceof NextResponse) return body;

  const repo = getRepository();
  const ride = await repo.getRideOccurrence(auth.societyId, body.journeyId);
  if (!ride) return errorResponse('Ride not found', 404);
  if (ride.offererUserId !== auth.userId) return errorResponse('Only the resident offering this ride can do this', 403);

  const now = Date.now();
  const blocker = body.action === 'START' ? startBlocker(ride, now) : completeBlocker(ride, now);
  if (blocker) return errorResponse(blocker, 409);

  const status = body.action === 'START' ? 'IN_PROGRESS' : 'COMPLETED';
  const updated = await repo.updateRideOccurrence(auth.societyId, ride.id, auth.userId, { status });

  // Tell the residents riding along
  const offerer = await repo.getUserById(auth.userId);
  const text =
    body.action === 'START'
      ? rideMessages.started(offerer?.fullName ?? '', ride.destinationName)
      : rideMessages.completed(offerer?.fullName ?? '', ride.destinationName);
  const riders = (await repo.listJourneyRequests(auth.societyId, ride.id)).filter((r) => r.status === 'ACCEPTED');
  const isoNow = new Date(now).toISOString();
  for (const rider of riders) {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: rider.seekerUserId,
      ...text,
      type: body.action === 'START' ? 'RIDE_STARTED' : 'RIDE_COMPLETED',
      link: '/rides/my-requests',
      read: false,
      createdAt: isoNow,
    });
  }

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: body.action === 'START' ? 'RIDE_STARTED' : 'RIDE_COMPLETED',
    entityType: 'RIDE_OCCURRENCE',
    entityId: ride.id,
    metadata: { riders: riders.length },
    createdAt: isoNow,
  });

  return NextResponse.json({ success: true, ride: updated });
}
