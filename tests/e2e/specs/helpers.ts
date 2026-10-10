import { expect, request, type Page } from '@playwright/test';

export const NOTICE = 'DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE';
const SHOTS = process.env.E2E_SCREENSHOTS; // directory, optional
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

export async function quickSignIn(page: Page, persona: string | RegExp) {
  await page.goto('/login');
  await expect(page.getByText(NOTICE)).toBeVisible();
  const button = page.getByRole('button', { name: persona }).first();
  if (!(await button.isVisible())) await page.getByText('More demo accounts').click();
  await button.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/**
 * Resets the demo to a story checkpoint through the admin console API, and
 * optionally jumps the demo clock to a time of day.
 */
export async function resetDemo(checkpointDay: number, timeOfDay?: string) {
  const admin = await request.newContext({ baseURL: BASE });
  const csrf = async () =>
    (await admin.storageState()).cookies.find((cookie) => cookie.name === 'hg_csrf')?.value ?? '';
  const signIn = async () =>
    expect(
      (
        await admin.post('/api/v1/auth/demo-login', {
          data: { email: 'admin@healthguard.demo' },
          // Stale cookies from before a reset still require the CSRF header.
          headers: { 'X-CSRF-Token': await csrf() },
        })
      ).ok(),
    ).toBe(true);
  await signIn();
  const reset = await admin.post('/api/v1/demo/reset', {
    data: { checkpointDay },
    headers: { 'X-CSRF-Token': await csrf() },
  });
  expect(reset.ok()).toBe(true);
  if (timeOfDay) {
    await signIn();
    const clock = await admin.post('/api/v1/demo/clock', {
      data: { timeOfDay },
      headers: { 'X-CSRF-Token': await csrf() },
    });
    expect(clock.ok()).toBe(true);
  }
  await admin.dispose();
}
