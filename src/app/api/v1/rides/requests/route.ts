import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/api-auth';
import { RideRequest, User } from '@/types';
import {
  CreateRideRequestSchema,
  ListRequestsQuerySchema,
  RequestIdQuerySchema,
  RespondToRequestSchema,
} from '@/lib/validation/schemas';
import { parseBody, parseQuery } from '@/lib/validation/parse';
import { ACTIVE_REQUEST_STATUSES, BookingFailure } from '@/lib/services/seat-booking';
import { estimateDetourMinutes } from '@/lib/services/matching';
import { meetsGenderPreference } from '@/lib/services/ride-rules';
import { rideMessages } from '@/lib/services/ride-messages';
import { settleStaleRides } from '@/lib/services/ride-lifecycle';
import { notify } from '@/lib/services/push';

const BOOKING_ERRORS: Record<BookingFailure, { message: string; status: number }> = {
  NOT_FOUND: { message: 'Request not found', status: 404 },
  FORBIDDEN: { message: 'You are not allowed to change this request', status: 403 },
  INVALID_STATE: { message: 'This request has already been handled', status: 409 },
  INSUFFICIENT_SEATS: { message: 'Not enough seats remaining on this ride', status: 409 },
  RIDE_UNAVAILABLE: { message: 'This ride is no longer available', status: 409 },
};

function bookingError(reason: BookingFailure) {
  const { message, status } = BOOKING_ERRORS[reason];
  return errorResponse(message, status);
}

/** "Priya Sharma" -> "Priya S." */
function shortName(user: User | null): string {
  if (!user) return 'Resident';
  const parts = user.fullName.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
}

// Request a seat on a journey
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, CreateRideRequestSchema);
  if (body instanceof NextResponse) return body;

  const {
    journeyId,
    requestedSeats,
    pickupName,
    pickupLat,
    pickupLng,
    dropoffName,
    dropoffLat,
    dropoffLng,
  } = body;

  const repo = getRepository();
  const journey = await repo.getRideOccurrence(auth.societyId, journeyId);
  if (!journey) return errorResponse('Journey not found', 404);

  if (journey.offererUserId === auth.userId) {
    return errorResponse('You cannot request a seat on your own offered ride');
  }
  if (journey.status !== 'OPEN' && journey.status !== 'PARTIALLY_BOOKED') {
    return errorResponse('This ride is no longer taking requests', 409);
  }
  if (Date.parse(journey.departureWindowStart) <= Date.now()) {
    return errorResponse('This ride has already departed', 409);
  }
  if (journey.availableSeats < requestedSeats) {
    return errorResponse('Not enough available seats', 409);
  }

  const seeker = await repo.getUserById(auth.userId);
  if (!seeker || !meetsGenderPreference(journey.genderPreference, seeker)) {
    return errorResponse('This ride is limited to riders of a different gender', 403);
  }

  const existing = await repo.listUserRequests(auth.societyId, auth.userId);
  if (existing.some((r) => r.journeyId === journeyId && ACTIVE_REQUEST_STATUSES.includes(r.status))) {
    return errorResponse('You already have a request on this ride', 409);
  }

  const pickup = {
    lat: pickupLat ?? journey.originLat,
    lng: pickupLng ?? journey.originLng,
  };
  const dropoff = {
    lat: dropoffLat ?? journey.destinationLat,
    lng: dropoffLng ?? journey.destinationLng,
  };

  const now = new Date().toISOString();
  const newRequest: RideRequest = {
    id: `req-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    journeyId,
    seekerUserId: auth.userId,
    requestedSeats,
    pickupName: pickupName || journey.meetingPoint || journey.originName,
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    dropoffName: dropoffName || journey.destinationName,
    dropoffLat: dropoff.lat,
    dropoffLng: dropoff.lng,
    calculatedDetourMinutes: estimateDetourMinutes(
      { lat: journey.originLat, lng: journey.originLng },
      { lat: journey.destinationLat, lng: journey.destinationLng },
      pickup,
      dropoff
    ),
    status: 'REQUESTED',
    createdAt: now,
    updatedAt: now,
  };

  const saved = await repo.createRideRequest(newRequest);

  // Notify the ride offerer of a new seat request
  await notify(repo, {
    id: `notif-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    userId: journey.offererUserId,
    ...rideMessages.requested(seeker.fullName, requestedSeats, journey.destinationName),
    type: 'RIDE_REQUESTED',
    link: '/rides/requests',
    read: false,
    createdAt: now,
  });

  await repo.recordAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    societyId: auth.societyId,
    actorUserId: auth.userId,
    action: 'SEAT_REQUESTED',
    entityType: 'RIDE_REQUEST',
    entityId: saved.id,
    metadata: { journeyId, requestedSeats },
    createdAt: now,
  });

  return NextResponse.json({ success: true, request: saved });
}

// Accept or Reject a seat request (Offerer only)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, RespondToRequestSchema);
  if (body instanceof NextResponse) return body;
  const { requestId, action, note } = body;

  const repo = getRepository();
  const result =
    action === 'ACCEPT'
      ? await repo.acceptRideRequest(auth.societyId, requestId, auth.userId, note)
      : await repo.closeRideRequest(auth.societyId, requestId, { userId: auth.userId, as: 'OFFERER' }, note);
  if (!result.ok) return bookingError(result.reason);

  const { journey, request } = result;
  const now = new Date().toISOString();

  if (action === 'ACCEPT') {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: request.seekerUserId,
      ...rideMessages.accepted((await repo.getUserById(auth.userId))?.fullName ?? '', journey.destinationName),
      type: 'REQUEST_ACCEPTED',
      link: '/rides/my-requests',
      read: false,
      createdAt: now,
    });

    // Audit contact disclosure
    await repo.recordAuditEvent({
      id: `audit-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      actorUserId: auth.userId,
      action: 'REQUEST_ACCEPTED_CONTACT_REVEALED',
      entityType: 'RIDE_REQUEST',
      entityId: requestId,
      metadata: { seekerUserId: request.seekerUserId },
      createdAt: now,
    });
  } else {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: request.seekerUserId,
      ...rideMessages.declined(journey.destinationName, result.previousStatus === 'ACCEPTED'),
      type: 'REQUEST_REJECTED',
      link: '/rides/find',
      read: false,
      createdAt: now,
    });
  }

  return NextResponse.json({ success: true, request });
}

// Get user requests (Seeker view) or journey requests (Offerer view)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, ListRequestsQuerySchema);
  if (query instanceof NextResponse) return query;
  const { journeyId } = query;

  const repo = getRepository();
  await settleStaleRides(repo, auth.societyId);

  if (journeyId) {
    // Requests on a journey (who asked, pickup points) are visible only to its offerer
    const journey = await repo.getRideOccurrence(auth.societyId, journeyId);
    if (!journey) return errorResponse('Journey not found', 404);
    if (journey.offererUserId !== auth.userId) {
      return errorResponse('Forbidden: Only the offerer can view requests for this ride', 403);
    }

    const journeyRequests = await repo.listJourneyRequests(auth.societyId, journeyId);
    const enriched = await Promise.all(
      journeyRequests.map(async (r) => {
        const seeker = await repo.getUserById(r.seekerUserId);
        // Contact details only once the offerer has accepted
        const membership =
          r.status === 'ACCEPTED' ? await repo.getMembership(auth.societyId, r.seekerUserId) : null;
        return {
          ...r,
          seekerName: r.status === 'ACCEPTED' ? seeker?.fullName ?? 'Resident' : shortName(seeker),
          seekerMobile: r.status === 'ACCEPTED' ? seeker?.mobile : undefined,
          seekerPhoto: r.status === 'ACCEPTED' ? seeker?.profilePhotoUrl : undefined,
          seekerFlat: membership?.flatNumber,
        };
      })
    );
    return NextResponse.json({ requests: enriched });
  }

  // List all requests submitted by this seeker
  const userRequests = await repo.listUserRequests(auth.societyId, auth.userId);
  const enriched = await Promise.all(
    userRequests.map(async (r) => {
      const journey = await repo.getRideOccurrence(auth.societyId, r.journeyId);
      const offerer = journey ? await repo.getUserById(journey.offererUserId) : null;
      const vehicle = journey ? await repo.getVehicleById(auth.societyId, journey.vehicleId) : null;
      const isAccepted = r.status === 'ACCEPTED' && journey !== null;
      const offererMembership = isAccepted
        ? await repo.getMembership(auth.societyId, journey.offererUserId)
        : null;
      return {
        ...r,
        journey,
        offererName: isAccepted ? offerer?.fullName ?? 'Resident' : shortName(offerer),
        offererMobile: isAccepted ? offerer?.mobile : undefined,
        offererPhoto: isAccepted ? offerer?.profilePhotoUrl : undefined,
        offererFlat: offererMembership?.flatNumber,
        vehicleName: vehicle ? `${vehicle.color} ${vehicle.make} ${vehicle.model}` : 'Vehicle',
        vehiclePlate: isAccepted ? vehicle?.registrationNumber : undefined,
      };
    })
  );

  return NextResponse.json({ requests: enriched });
}

// Cancel a request (Seeker only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(req, RequestIdQuerySchema);
  if (query instanceof NextResponse) return query;

  const repo = getRepository();
  const result = await repo.closeRideRequest(auth.societyId, query.requestId, {
    userId: auth.userId,
    as: 'SEEKER',
  });
  if (!result.ok) return bookingError(result.reason);

  // Seats were released: tell the offerer
  if (result.previousStatus === 'ACCEPTED') {
    await notify(repo, {
      id: `notif-${crypto.randomUUID()}`,
      societyId: auth.societyId,
      userId: result.journey.offererUserId,
      ...rideMessages.seekerCancelled(
        (await repo.getUserById(auth.userId))?.fullName ?? '',
        result.request.requestedSeats,
        result.journey.destinationName
      ),
      type: 'RIDE_CANCELLED',
      link: '/rides/my-rides',
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true, request: result.request });
}
