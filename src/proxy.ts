import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CORS for the Club House phone apps. The iOS and Android apps load their
 * screens from these local origins and call the API with a Bearer token.
 * Credentials (cookies) are never allowed cross-origin, so a website cannot
 * use a resident's browser session through this.
 */
export const NATIVE_APP_ORIGINS = ['capacitor://localhost', 'https://localhost'];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-society-id',
  'Access-Control-Max-Age': '600',
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  const allowed = NATIVE_APP_ORIGINS.includes(origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: allowed ? 204 : 403,
      headers: allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', ...CORS_HEADERS } : { Vary: 'Origin' },
    });
  }

  const response = NextResponse.next();
  response.headers.set('Vary', 'Origin');
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
