import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/api-auth';
import { formatPublicJourneyView } from '@/lib/services/privacy';
import { RideOccurrence } from '@/types';
import {
  CancelRideQuerySchema,
  CreateRideSchema,
  ListRidesQuerySchema,
  UpdateRideSchema,
} from '@/lib/validation/schemas';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { estimateRoute } from '@/lib/services/matching';
import { validateDepartureWindow } from '@/lib/services/ride-rules';
import { journeyStatusForSeats } from '@/lib/services/seat-booking';
import { rideMessages } from '@/lib/services/ride-messages';
import { formatIstDay } from '@/lib/utils/time';

// List available rides or user's rides
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ListRidesQuerySchema);
  if (query instanceof NextResponse) return query;
  const date = query.date;
  const myRidesOnly = query.mine === 'true';

  const repo = getRepository();

  if (myRidesOnly) {
    const userRides = await repo.listUserRides(auth.societyId, auth.userId);
    return NextResponse.json({ rides: userRides });
  }

  // Anonymize and format privacy views
  const userRequests = await repo.listUserRequests(auth.societyId, auth.userId);
  const requestMap = new Map(userRequests.map((r) => [r.journeyId, r.status]));

  // Open society rides (today + upcoming). Rides that have already left can
  // no longer be requested, so only their offerer and accepted riders see them.
  const now = Date.now();
  const openRides = (await repo.listOpenRides(auth.societyId, date)).filter(
    (ride) =>
      Date.parse(ride.departureWindowStart) > now ||
      ride.offererUserId === auth.userId ||
      requestMap.get(ride.id) === 'ACCEPTED'
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

      return formatPublicJourneyView(ride, offerer, vehicle, {
        isOfferer: ride.offererUserId === auth.userId,
        seekerRequestStatus,
        offererFlatNumber,
      });
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
  const origin = {
    name: originName || society.name,
    lat: originLat ?? society.latitude,
    lng: originLng ?? society.longitude,
  };
  const destination = { lat: destinationLat, lng: destinationLng };
  const route = estimateRoute(origin, destination);

  const now = new Date().toISOString();
  const occurrence: RideOccurrence = {
    id: `jrn-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    offererUserId: auth.userId,
    vehicleId,
    journeyDate,
    direction: direction || 'OUTBOUND_SOCIETY',
    departureWindowStart,
    departureWindowEnd: windowEnd,
    originName: origin.name,
    originLat: origin.lat,
    originLng: origin.lng,
    ...(meetingPoint ? { meetingPoint } : {}),
    destinationName,
    ...(destinationPlaceId ? { destinationPlaceId } : {}),
    destinationLat,
    destinationLng,
    baselineDurationMinutes: route.durationMinutes,
    baselineDistanceKm: route.distanceKm,
    totalSeats,
    availableSeats: totalSeats,
    // Gender-restricted rides only where the society allows them
    genderPreference: society.settings.allow_gender_preferences ? genderPreference : 'ANY',
    visibility: visibility || 'SOCIETY_WIDE',
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
  };

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
  const { journeyId, destinationName, meetingPoint, departureWindowStart, departureWindowEnd, totalSeats, genderPreference } =
    body;

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
    await repo.createNotification({
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
