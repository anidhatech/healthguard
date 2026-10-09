import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against an already-running stack (docker compose up, or the API and
 * web started on the host). Set E2E_BASE_URL to point elsewhere.
 * CHROMIUM_PATH lets sandboxes reuse a preinstalled browser.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
