import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, PHONE, USERS, signInAs } from './helpers';

/** The main pages, and who opens them */
const PAGES: [who: string | null, path: string][] = [
  [null, '/'],
  [USERS.priya, '/'],
  [USERS.priya, '/rides'],
  [USERS.rohan, '/rides/offer'],
  [USERS.priya, '/lessons'],
  [USERS.priya, '/circles'],
  [USERS.priya, '/circles/create'],
  [USERS.priya, '/circles/mine'],
  [USERS.priya, '/profile'],
  [USERS.admin, '/'],
  [USERS.admin, '/admin'],
  [USERS.admin, '/admin?tab=MEMBERS'],
  [USERS.admin, '/admin?tab=CIRCLES'],
  [USERS.admin, '/admin?tab=SETTINGS'],
];

async function open(page: Page, who: string | null, path: string) {
  if (who) await signInAs(page, who);
  else {
    await page.goto('/offline.html');
    await page.evaluate(() => localStorage.setItem('junto_logged_out', 'true'));
  }
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible();
  // Let data load and the page settle
  await page.waitForTimeout(1500);
}

for (const [name, viewport] of [
  ['phone', PHONE],
  ['desktop', DESKTOP],
] as const) {
  test.describe(`accessibility on ${name}`, () => {
    test.use({ viewport });
    for (const [who, path] of PAGES) {
      test(`${path} as ${who ?? 'signed out'}`, async ({ page }) => {
        await open(page, who, path);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('nextjs-portal').analyze();
        const problems = results.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).slice(0, 3).join('\n  ')}`);
        expect(problems, problems.join('\n')).toEqual([]);
        // No sideways scrolling on any screen
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      });
    }
  });
}
