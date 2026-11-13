import { NextResponse } from 'next/server';

/**
 * Tells Android that invite links (/join/…) open the Club House app. Set
 * ANDROID_PACKAGE and ANDROID_SHA256_FINGERPRINTS (comma separated, from the
 * Play Console's app signing page) once the app exists.
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE;
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  if (!packageName || fingerprints.length === 0) return new NextResponse(null, { status: 404 });
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
