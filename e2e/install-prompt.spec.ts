import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';
import { USERS, signInAs } from './helpers';

const card = (page: Page) => page.getByRole('region', { name: /Add Club House to your home screen/ });

/** The browser's install offer, as Chrome sends it (it cannot be triggered for real in a test) */
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(e);
  });
}

test.describe('Add to home screen on Android', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('appears from the second visit and opens the install dialog', async ({ page }) => {
    await signInAs(page, USERS.priya);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Namaste, Priya/ })).toBeVisible();
    await offerInstall(page);
    await expect(card(page)).toHaveCount(0); // first visit

    // A later visit (a new browser session)
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('heading', { name: /Namaste, Priya/ })).toBeVisible();
    await offerInstall(page);
    await expect(card(page)).toBeVisible();
    await page.screenshot({ path: 'test-results/install-card-android.png' });
    await card(page).getByRole('button', { name: 'Install' }).click();
    await expect(page.getByText('Club House is on your home screen')).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});

test.describe('Add to home screen on iPhone', () => {
  // An iPhone's screen and browser name, in Chromium
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('shows the Share steps, and ✕ hides them on this phone for good', async ({ page }) => {
    await signInAs(page, USERS.rohan);
    await page.evaluate(() => localStorage.setItem('clubhouse_visits', '1'));
    await page.goto('/');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('Add to Home Screen');
    await page.screenshot({ path: 'test-results/install-card-iphone.png' });
    const axe = await new AxeBuilder({ page })
      .include('[aria-labelledby="install-title"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await card(page)
      .getByRole('button', { name: /Not now/ })
      .click();
    await expect(card(page)).toHaveCount(0);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('heading', { name: /Namaste, Rohan/ })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});
