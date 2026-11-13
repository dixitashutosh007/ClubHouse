import { NextRequest, NextResponse } from 'next/server';
import { calculateHaversineDistanceKm } from '@/lib/services/matching';
import { requireAuth, serverError } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { RoutesMatrixSchema } from '@/lib/validation/schemas';
import { parseBody } from '@/lib/validation/parse';

// In-memory cache for Bangalore route durations with TTL (prevents duplicate billing)
const routeCache = new Map<string, { durationMinutes: number; distanceKm: number; cachedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Server-Side Routes API & Detour Matrix Calculator
 * Calculates driving travel time and incremental detour time.
 * When GOOGLE_MAPS_API_KEY is configured, invokes Google Routes API v2 / Distance Matrix.
 * Otherwise uses calibrated Bangalore traffic model (25 km/h urban speed) with caching.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const limit = await rateLimit(`routes:${auth.userId}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many route calculations. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const body = await parseBody(req, RoutesMatrixSchema);
  if (body instanceof NextResponse) return body;
  const { origin, destination, waypoints } = body;

  try {

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Cache key based on rounded coordinates (~100m precision)
    const directKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}->${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
    const now = Date.now();

    let directDurationMinutes = 40;
    let directDistanceKm = 18;

    const cachedDirect = routeCache.get(directKey);
    if (cachedDirect && now - cachedDirect.cachedAt < CACHE_TTL_MS) {
      directDurationMinutes = cachedDirect.durationMinutes;
      directDistanceKm = cachedDirect.distanceKm;
    } else if (apiKey) {
      try {
        const routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
        const res = await fetch(routesUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
            destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const durationSec = parseInt(data.routes[0].duration.replace('s', '')) || 2400;
            const distanceMeters = data.routes[0].distanceMeters || 18000;
            directDurationMinutes = Math.round(durationSec / 60);
            directDistanceKm = Math.round(distanceMeters / 1000);
            routeCache.set(directKey, { durationMinutes: directDurationMinutes, distanceKm: directDistanceKm, cachedAt: now });
          }
        }
      } catch (err) {
        console.warn('Google Routes API call failed, falling back to calibrated calculation', err);
      }
    } else {
      // Fallback calibrated calculation
      const dist = calculateHaversineDistanceKm(origin, destination);
      directDistanceKm = Math.round(dist * 1.3); // Road factor
      directDurationMinutes = Math.round(directDistanceKm * 2.4); // 25 km/h urban traffic
      routeCache.set(directKey, { durationMinutes: directDurationMinutes, distanceKm: directDistanceKm, cachedAt: now });
    }

    let waypointDurationMinutes = directDurationMinutes;
    let detourMinutes = 0;

    if (waypoints && waypoints.length > 0) {
      // Calculate route via waypoints: Origin -> Waypoint1 -> Waypoint2 -> Destination
      let totalWaypointKm = 0;
      let prev = origin;
      for (const wp of waypoints) {
        totalWaypointKm += calculateHaversineDistanceKm(prev, wp) * 1.3;
        prev = wp;
      }
      totalWaypointKm += calculateHaversineDistanceKm(prev, destination) * 1.3;

      const deltaKm = Math.max(0, totalWaypointKm - directDistanceKm);
      detourMinutes = Math.round(deltaKm * 2.4 + 2); // traffic duration + pickup buffer
      waypointDurationMinutes = directDurationMinutes + detourMinutes;
    }

    return NextResponse.json({
      directDurationMinutes,
      directDistanceKm,
      waypointDurationMinutes,
      detourMinutes,
      isCompatible10MinRule: detourMinutes <= 10,
    });
  } catch (err) {
    return serverError('Routing calculation failed', err);
  }
}
