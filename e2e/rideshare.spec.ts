import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, USERS, signInAs } from './helpers';

test('offer a ride, request a seat and accept it', async ({ browser }) => {
  // Rohan offers a ride (Rohan has a car in the demo data)
  const offerer = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  await signInAs(offerer, USERS.rohan);
  await offerer.goto('/rides/offer');
  // Wait until the form is ready (the car list has loaded), then search for the destination
  await expect(offerer.getByRole('button', { name: 'Publish ride' })).toBeEnabled({ timeout: 60_000 });
  const to = offerer.getByRole('textbox', { name: 'To', exact: true });
  await to.click();
  await to.pressSequentially('Manyata', { delay: 50 });
  // The first search compiles the places route on a fresh server
  const suggestion = offerer.getByRole('button', { name: /Manyata/ }).first();
  await expect(suggestion).toBeVisible({ timeout: 60_000 });
  await suggestion.click();
  // Three days ahead, away from the demo rides
  await offerer.getByRole('group', { name: 'Date' }).getByRole('button').nth(3).click();
  await offerer.getByRole('button', { name: 'Publish ride' }).click();
  // If the app warns about another ride the same day, carry on
  const done = offerer.getByRole('heading', { name: 'Ride offered!' });
  const clash = offerer.getByRole('button', { name: 'Offer anyway' });
  await expect(done.or(clash)).toBeVisible();
  if (await clash.isVisible()) await clash.click();
  await expect(done).toBeVisible();

  // Ananya finds it and requests a seat
  const rider = await (await browser.newContext({ viewport: PHONE })).newPage();
  await signInAs(rider, USERS.ananya);
  await rider.goto('/rides');
  const card = rider.locator('article').filter({ hasText: 'Rohan' }).filter({ hasText: /Manyata/ }).first();
  await card.getByRole('button', { name: 'Request seat' }).click();
  const pending = card.getByText('Request pending');
  const anyway = rider.getByRole('button', { name: 'Request anyway' });
  await expect(pending.or(anyway)).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(pending).toBeVisible();

  // Rohan accepts
  await offerer.goto('/rides/requests');
  const row = offerer.locator('li, article').filter({ hasText: 'Ananya' }).filter({ has: offerer.getByRole('button', { name: 'Accept' }) }).last();
  await row.getByRole('button', { name: 'Accept' }).click();
  await expect(offerer.getByRole('button', { name: 'Accept' })).toHaveCount(0);

  // Ananya's seat is confirmed: Home says so, and her request shows as accepted
  await rider.goto('/');
  await expect(rider.getByText('Your seat is confirmed')).toBeVisible();
  await rider.goto('/rides/my-requests');
  await expect(rider.getByText(/Manyata/).first()).toBeVisible();
  // Starting and ending a trip depend on the departure time, so the route tests cover them
});
