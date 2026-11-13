import { NextRequest, NextResponse } from 'next/server';
import { BANGALORE_HUBS, PlaceSuggestion } from '@/lib/services/places-data';
import { ONBOARDING_STATUSES, requireAuth } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { PlacesQuerySchema } from '@/lib/validation/schemas';
import { parseQuery } from '@/lib/validation/parse';

// Server-side cache for geocoded Place IDs (prevents redundant Google API calls)
const geocodeCache = new Map<string, { lat: number; lng: number; formattedAddress: string }>();
const GEOCODE_CACHE_MAX = 1000;

function cacheLocation(placeId: string, loc: { lat: number; lng: number; formattedAddress: string }) {
  if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) geocodeCache.delete(oldest);
  }
  cacheLocation(placeId, loc);
}

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    countrycode?: string;
    osm_type?: string;
    osm_id?: number;
  };
}

/**
 * Production Places Autocomplete API Endpoint
 * 
 * Capabilities:
 * 1. Checks GOOGLE_MAPS_API_KEY from environment variables / AWS Secrets.
 * 2. When configured, queries Google Places API (New) with:
 *    - Strict India country restriction (`components=country:in`).
 *    - Bangalore Metropolitan Area location bias (Lat 12.9716, Lng 77.5946, 45km radius).
 *    - Auto-geocodes selected places to exact GPS coordinates.
 * 3. When offline or during local development, uses the comprehensive
 *    curated Bangalore Tech Parks & localities dataset with fuzzy token matching.
 */
export async function GET(req: NextRequest) {
  // Signed-in residents only (including onboarding), since lookups can bill the Maps API key
  const auth = await requireAuth(req, { statuses: ONBOARDING_STATUSES });
  if (auth instanceof NextResponse) return auth;

  const limit = await rateLimit(`places:${auth.userId}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many searches. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const params = parseQuery(req, PlacesQuerySchema);
  if (params instanceof NextResponse) return params;
  const query = params.q ?? '';
  const placeId = params.placeId; // Optional: fetch exact lat/lng for selected place

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. If placeId is provided, resolve exact GPS coordinates
  if (placeId) {
    // Check in-memory geocode cache
    if (geocodeCache.has(placeId)) {
      return NextResponse.json({ location: geocodeCache.get(placeId) });
    }

    // Check Bangalore curated dataset first
    const localMatch = BANGALORE_HUBS.find((h) => h.placeId === placeId);
    if (localMatch) {
      const loc = { lat: localMatch.lat, lng: localMatch.lng, formattedAddress: `${localMatch.primaryText}, ${localMatch.secondaryText}` };
      cacheLocation(placeId, loc);
      return NextResponse.json({ location: loc });
    }

    // If API key is available, resolve via Google Place Details
    if (apiKey) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address&key=${apiKey}`;
        const res = await fetch(detailsUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.result?.geometry?.location) {
            const loc = {
              lat: data.result.geometry.location.lat,
              lng: data.result.geometry.location.lng,
              formattedAddress: data.result.formatted_address || '',
            };
            cacheLocation(placeId, loc);
            return NextResponse.json({ location: loc });
          }
        }
      } catch (err) {
        console.warn('Google Place Details lookup failed', err);
      }
    }

    // Never guess a location: the client asks the user to pick again
    return NextResponse.json({ error: 'Location not found for this place' }, { status: 404 });
  }

  // 2. Query Google Places Predictions if API Key exists
  if (apiKey && query.length >= 2) {
    try {
      const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      googleUrl.searchParams.set('input', query);
      googleUrl.searchParams.set('key', apiKey);
      googleUrl.searchParams.set('components', 'country:in');
      googleUrl.searchParams.set('location', '12.9716,77.5946'); // Bangalore center
      googleUrl.searchParams.set('radius', '45000'); // 45km radius covering Greater Bangalore

      const res = await fetch(googleUrl.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
          const suggestions: PlaceSuggestion[] = data.predictions.map((p: GooglePrediction) => ({
            placeId: p.place_id,
            primaryText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || 'Bangalore, Karnataka',
            // Placeholder: the client resolves exact coordinates via ?placeId=
            lat: 12.9716,
            lng: 77.5946,
          }));
          return NextResponse.json({ suggestions, source: 'google_places' });
        }
      }
    } catch (err) {
      console.warn('Google Places API request failed, falling back to open dataset', err);
    }
  }

  // 3. Tier 1: Instant In-Memory Curated Bangalore Tech Parks & Corridors (0ms)
  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery.split(/\s+/).filter(Boolean);

  let localMatches: PlaceSuggestion[] = [];
  if (queryTokens.length > 0) {
    localMatches = BANGALORE_HUBS.filter((hub) => {
      const fullText = `${hub.primaryText} ${hub.secondaryText}`.toLowerCase();
      return queryTokens.every((token) => fullText.includes(token)) ||
             queryTokens.some((token) => fullText.includes(token));
    });
  }

  // If we have strong local curated matches (e.g. 3 or more), return them instantly for zero latency
  if (localMatches.length >= 3 || query.length < 2) {
    return NextResponse.json({
      suggestions: localMatches.slice(0, 8),
      source: 'curated_bangalore',
    });
  }

  // 4. Tier 2: OpenStreetMap (OSM / Photon) Zero-Cost Search with Bangalore Focus
  let osmSuggestions: PlaceSuggestion[] = [];
  if (query.length >= 2) {
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=12.9716&lon=77.5946&limit=6`;
      const osmRes = await fetch(photonUrl, {
        headers: { 'User-Agent': 'ClubHouse-Community-App/1.0' },
        signal: AbortSignal.timeout(1800), // Quick timeout so it never hangs
      });

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (osmData.features && Array.isArray(osmData.features)) {
          osmSuggestions = osmData.features
            .filter((f: PhotonFeature) => f.properties?.countrycode === 'IN' || !f.properties?.countrycode)
            // Skip results without coordinates rather than guessing a location
            .filter((f: PhotonFeature) => Array.isArray(f.geometry?.coordinates))
            .map((f: PhotonFeature, idx: number) => {
              const p = f.properties || {};
              const coords = f.geometry!.coordinates!;
              const name = p.name || p.street || p.district || query;
              const secondaryParts = [p.locality, p.district, p.city || 'Bengaluru', p.state]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i && v !== name);

              return {
                placeId: `osm_${p.osm_type || 'N'}_${p.osm_id ?? idx}`,
                primaryText: name,
                secondaryText: secondaryParts.length > 0 ? secondaryParts.join(', ') : 'Bangalore, Karnataka',
                lat: coords[1],
                lng: coords[0],
              };
            });
        }
      }
    } catch (osmErr) {
      // In case of network timeout, continue gracefully with local matches
      console.warn('Photon OSM geocode skipped', osmErr);
    }
  }

  // Merge: Local curated matches first, then deduplicated OSM matches
  const combined: PlaceSuggestion[] = [...localMatches];
  for (const s of osmSuggestions) {
    const isDuplicate = combined.some(
      (c) => c.primaryText.toLowerCase() === s.primaryText.toLowerCase()
    );
    if (!isDuplicate) combined.push(s);
  }

  return NextResponse.json({
    suggestions: combined.length > 0 ? combined.slice(0, 8) : BANGALORE_HUBS.slice(0, 8),
    source: osmSuggestions.length > 0 ? 'osm_photon' : 'curated_bangalore',
  });
}
