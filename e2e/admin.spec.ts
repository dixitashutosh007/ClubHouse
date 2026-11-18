import { expect, test } from '@playwright/test';
import { DESKTOP, USERS, api, signInAs, unique } from './helpers';

test.use({ viewport: DESKTOP });

test('a society admin approves a resident, a class and a circle', async ({ page, request }) => {
  await signInAs(page, USERS.admin);

  // A resident waiting for approval (Rahul, in the demo data)
  await page.goto('/admin?tab=MEMBERS');
  await page.getByRole('button', { name: 'Approve Rahul Verma' }).first().click();
  const confirmResident = page.getByRole('dialog').getByRole('button', { name: /approve/i });
  if (await confirmResident.isVisible({ timeout: 2000 }).catch(() => false)) await confirmResident.click();
  await expect(page.getByRole('button', { name: 'Approve Rahul Verma' })).toHaveCount(0);

  // A class waiting for approval (in the demo data)
  await page.goto('/admin?tab=CLASSES');
  const classCard = page.locator('section[aria-labelledby=class-approvals] article').first();
  await expect(classCard).toBeVisible();
  const subject = await classCard.locator('h3').innerText();
  await classCard.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('article').filter({ hasText: subject }).getByRole('button', { name: 'Approve' })).toHaveCount(0);

  // A circle a resident has just started
  const name = unique('Evening Walkers');
  await api(request, USERS.priya, 'POST', '/api/v1/circles', { name, type: 'Community', description: 'Walks around the society after dinner.' });
  await page.goto('/admin?tab=CIRCLES');
  const circleCard = page.locator('article').filter({ hasText: name });
  await circleCard.getByRole('button', { name: 'Approve' }).click();
  await expect(circleCard.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  // It is now live for residents
  const live = await api<{ circles: { name: string }[] }>(request, USERS.rohan, 'GET', '/api/v1/circles');
  expect(live.circles.map((c) => c.name)).toContain(name);
});
