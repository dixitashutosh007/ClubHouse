import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, USERS, pressToggle, signInAs } from './helpers';

test("ride cards show an electric car's fuel, and owners can change their car's fuel", async ({ browser }) => {
  // Ananya's Tata Nexon EV is electric in the demo data
  const rider = await (await browser.newContext({ viewport: PHONE })).newPage();
  await signInAs(rider, USERS.priya);
  await rider.goto('/rides');
  const evRide = rider.locator('article').filter({ hasText: 'Nexon EV' }).first();
  await expect(evRide).toContainText('Electric');

  // Ashutosh switches his car to diesel in Profile
  const owner = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  await signInAs(owner, USERS.ashutosh);
  await owner.goto('/profile');
  await owner.getByRole('button', { name: /^Fuel and mileage for Hyundai/ }).click();
  await pressToggle(owner.getByRole('button', { name: 'Diesel', exact: true }));
  await expect(owner.getByLabel('Mileage (km/L)')).toHaveValue('18');
  await owner.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(owner.getByText('Diesel · 18 km/L')).toBeVisible();

  // Picking electric changes the unit
  await owner.getByRole('button', { name: /^Fuel and mileage for Hyundai/ }).click();
  await pressToggle(owner.getByRole('button', { name: 'Electric', exact: true }));
  await expect(owner.getByLabel('Mileage (km/kWh)')).toHaveValue('7');
  await owner.getByRole('button', { name: 'Cancel' }).first().click();
});
