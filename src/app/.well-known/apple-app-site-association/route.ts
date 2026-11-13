import { NextResponse } from 'next/server';

/**
 * Tells iOS that invite links (/join/…) open the Club House app when it is
 * installed. Set APPLE_APP_ID to "<Team ID>.<bundle id>" once the app exists.
 */
export function GET() {
  const appId = process.env.APPLE_APP_ID;
  if (!appId) return new NextResponse(null, { status: 404 });
  return NextResponse.json({
    applinks: { details: [{ appIDs: [appId], components: [{ '/': '/join/*' }] }] },
  });
}
