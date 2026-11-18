import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: real pages in Chromium against the development server and
 * its seeded demo data (MockDynamoRepository, dev sign-in). They never touch
 * production. Run with `npm run test:e2e`; CI runs them on every pull request.
 *
 * The demo data lives in the server's memory and the tests share one server,
 * so they run one at a time and each test creates what it needs.
 */
const PORT = 3300;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // A failure is a real failure: no automatic retries
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/offline.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
