import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/db';
import { errorResponse, requireAuth } from '@/lib/api-auth';
import { istDateString } from '@/lib/utils/time';
import { meetsGenderPreference } from '@/lib/services/ride-rules';
import { evaluateCommuteMatch } from '@/lib/services/matching';
import { FindMatchesSchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';
import { findKnownPlace } from '@/lib/services/places-data';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(req, FindMatchesSchema);
  if (body instanceof NextResponse) return body;
  const { pickupName, pickupLat, pickupLng, dropoffName, dropoffLat, dropoffLng, preferredTime, date } = body;

  const known = dropoffLat === undefined || dropoffLng === undefined ? findKnownPlace(dropoffName) : null;
  const dropoff =
    dropoffLat !== undefined && dropoffLng !== undefined
      ? { lat: dropoffLat, lng: dropoffLng }
      : known
        ? { lat: known.lat, lng: known.lng }
        : null;
  if (!dropoff) return NextResponse.json({ matches: [], needsLocation: true });

  const repo = getRepository();
  const society = await repo.getSocietyById(auth.societyId);
  if (!society) return errorResponse('Society not found', 404);
  const maxDetour = society.settings.max_detour_minutes;
  const seeker = await repo.getUserById(auth.userId);

  const queryDate = date || istDateString();
  const openRides = await repo.listOpenRides(auth.societyId, queryDate);

  const matches = [];
  const now = Date.now();

  for (const ride of openRides) {
    if (ride.offererUserId === auth.userId) continue;
    if (Date.parse(ride.departureWindowStart) <= now) continue;
    if (!seeker || !meetsGenderPreference(ride.genderPreference, seeker)) continue;

    const match = evaluateCommuteMatch({
      journey: ride,
      seekerUserId: auth.userId,
      // Seekers start from the society unless they give another pickup point
      seekerPickup: {
        name: pickupName || society.name,
        lat: pickupLat ?? society.latitude,
        lng: pickupLng ?? society.longitude,
      },
      seekerDropoff: {
        name: dropoffName || 'Drop-off',
        lat: dropoff.lat,
        lng: dropoff.lng,
      },
      seekerPreferredTime: preferredTime || ride.departureWindowStart,
      maxDetourMinutes: maxDetour,
    });

    if (match) {
      const offerer = await repo.getUserById(ride.offererUserId);
      const vehicle = await repo.getVehicleById(auth.societyId, ride.vehicleId);
      matches.push({
        match,
        journey: ride,
        offererName: offerer ? `${offerer.fullName.split(' ')[0]} ${offerer.fullName.split(' ')[1]?.charAt(0) || ''}.` : 'Resident',
        vehicleModel: vehicle ? `${vehicle.color} ${vehicle.make} ${vehicle.model}` : 'Car',
      });
    }
  }

  return NextResponse.json({
    matches,
    maxDetourApplied: maxDetour,
  });
}
