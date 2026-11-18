import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const SOCIETY = 'soc-ggh-001';

/** Seeded demo residents (development data only) */
export const USERS = {
  appAdmin: 'usr-app-admin-001', // Rajesh, app admin
  admin: 'usr-admin-001', // Vikram, society admin
  ashutosh: 'usr-offerer-001', // offers ride jrn-001
  priya: 'usr-seeker-001',
  rohan: 'usr-offerer-002',
  ananya: 'usr-offerer-003',
  rahul: 'usr-pending-001', // waiting for approval
} as const;

export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1280, height: 900 };

/** Opens the app as a demo resident (the development persona switcher) */
export async function signInAs(page: Page, userId: string) {
  await page.goto('/offline.html');
  await page.evaluate((id) => {
    localStorage.removeItem('junto_logged_out');
    localStorage.setItem('junto_dev_persona', id);
    localStorage.setItem('clubhouse_tour_seen', '1');
  }, userId);
}

/** Calls the API as a demo resident, to set up data a test needs */
export async function api<T = Record<string, unknown>>(
  request: APIRequestContext,
  userId: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown
): Promise<T> {
  const res = await request.fetch(path, {
    method,
    headers: { 'x-dev-user-id': userId, 'x-society-id': SOCIETY },
    data,
  });
  expect(res.ok(), `${method} ${path} → ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/** A name no other test run has used (the demo data lives for the whole server run) */
export const unique = (label: string) => `${label} ${Math.random().toString(36).slice(2, 7)}`;
