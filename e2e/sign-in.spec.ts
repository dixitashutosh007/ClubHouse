import { expect, test } from '@playwright/test';
import { PHONE } from './helpers';

test.use({ viewport: PHONE });

test('a resident signs in with their mobile and the test code', async ({ page }) => {
  await page.goto('/offline.html');
  await page.evaluate(() => localStorage.setItem('junto_logged_out', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with your mobile' }).click();
  await page.getByLabel(/mobile number/i).fill('9822233344');
  await page.getByRole('dialog').getByRole('button', { name: /send|continue|get code/i }).click();
  await page.getByLabel(/6-digit/i).fill('123456');
  await page.getByRole('dialog').getByRole('button', { name: /verify|sign in|continue/i }).first().click();
  await expect(page.getByRole('heading', { name: /Namaste, Priya/ })).toBeVisible();
});
