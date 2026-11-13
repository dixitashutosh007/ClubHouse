'use client';

/**
 * Browser helper for calling the Club House API.
 *
 * Production requests are identified by the httpOnly session cookie and the
 * selected-society cookie, so callers never pass user or society IDs.
 * Development builds also send the demo persona chosen in the role switcher.
 */

const DEV_PERSONA_KEY = 'junto_dev_persona';
const DEFAULT_DEV_PERSONA = 'usr-offerer-001';
const SOCIETY_COOKIE = 'junto_society_id';

const isDev = process.env.NODE_ENV !== 'production';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Development only: the demo user the API should act as */
export function getDevPersona(): string {
  return readStorage(DEV_PERSONA_KEY) || DEFAULT_DEV_PERSONA;
}

export function setDevPersona(userId: string): void {
  try {
    localStorage.setItem(DEV_PERSONA_KEY, userId);
  } catch {
    // Storage unavailable (private mode); persona resets on reload
  }
}

/** Selects the society used by later requests (read by the server from a cookie) */
export function selectSociety(societyId: string): void {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${SOCIETY_COOKIE}=${encodeURIComponent(societyId)}; path=/; max-age=${60 * 60 * 24 * 14}; samesite=lax${secure}`;
}

interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  /** JSON body; sets the method to POST unless one is given */
  json?: unknown;
  body?: BodyInit;
}

export function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const { json, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);

  if (json !== undefined) finalHeaders.set('Content-Type', 'application/json');
  if (isDev) finalHeaders.set('x-dev-user-id', getDevPersona());

  return fetch(path, {
    ...rest,
    method: rest.method ?? (json !== undefined ? 'POST' : 'GET'),
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: 'same-origin',
  });
}

/** Reads `{ error }` from a failed response, with a fallback message */
export async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === 'string' && data.error) || fallback;
}
