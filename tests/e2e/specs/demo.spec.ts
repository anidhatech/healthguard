import { expect, test, type Page } from '@playwright/test';

const NOTICE = 'DEMO • SYNTHETIC HEALTH DATA • NOT FOR CLINICAL USE';
const SHOTS = process.env.E2E_SCREENSHOTS; // directory, optional

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function quickSignIn(page: Page, persona: string | RegExp) {
  await page.goto('/login');
  await expect(page.getByText(NOTICE)).toBeVisible();
  const button = page.getByRole('button', { name: persona }).first();
  if (!(await button.isVisible())) await page.getByText('More demo accounts').click();
  await button.click();
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('login page shows demo accounts and the DEMO/DEVELOPMENT notice', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('DEMO / DEVELOPMENT', { exact: true })).toBeVisible();
  await expect(page.getByText(/not identity verification/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Ananya Rao/ })).toBeVisible();
  await shot(page, '01-login');
});

test('signed-out visitors are sent to sign-in', async ({ page }) => {
  await page.goto('/patient/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fpatient%2Fdashboard/);
});

test('patient sees progress since the last visit and Telugu instructions', async ({ page }) => {
  await quickSignIn(page, /Ananya Rao/);
  await expect(page).toHaveURL(/\/patient\/dashboard/);
  await expect(page.getByText(NOTICE)).toBeVisible();
  await expect(page.getByText('6.8%')).toBeVisible();
  await expect(page.getByText('7,100')).toBeVisible();
  await expect(page.getByText('92%')).toBeVisible();
  await shot(page, '02-patient-dashboard');
  await page
    .getByRole('link', { name: /Medicines|మందులు|दवाइयाँ/ })
    .first()
    .click();
  await expect(
    page.getByText('ఉదయం టిఫిన్ చేసిన 15 నిమిషాల తర్వాత Metformin 500 mg 1 టాబ్లెట్ తీసుకోండి.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText('తదుపరి దశలో వస్తుంది').first()).toBeVisible();
  await shot(page, '03-patient-medications');
});

test('patient can switch language to English', async ({ page }) => {
  await quickSignIn(page, /Ananya Rao/);
  const language = page.locator('header select');
  await language.selectOption('en-IN');
  await expect(page.getByRole('link', { name: 'Medicines' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.goto('/patient/medications');
  await expect(
    page.getByText(
      'Take 1 tablet of Metformin 500 mg, 15 minutes after breakfast. Once a day, for 90 days.',
    ),
  ).toBeVisible();
  await page.goto('/patient/tests');
  await expect(page.getByRole('cell', { name: /6\.8 %/ }).first()).toBeVisible();
  await shot(page, '04-patient-tests');
  await page.goto('/patient/consent');
  await expect(page.getByText('Who looked at your data')).toBeVisible();
  await shot(page, '05-patient-consent');
  // Restore Ananya's saved preference (Telugu) for the next run.
  await page.locator('header select').selectOption('te-IN');
  await expect(page.getByRole('link', { name: 'మందులు' })).toBeVisible();
  await page.waitForLoadState('networkidle');
});

test('doctor generates a cited AI pre-visit summary', async ({ page }) => {
  await quickSignIn(page, /Dr\. Meera Sharma/);
  await expect(page).toHaveURL(/\/doctor\/dashboard/);
  await expect(
    page
      .getByText("Today's schedule")
      .or(page.getByText(/schedule/i))
      .first(),
  ).toBeVisible();
  await shot(page, '06-doctor-dashboard');
  await page.getByRole('link', { name: 'Open' }).first().click();
  await expect(page.getByRole('heading', { name: 'Ananya Rao' })).toBeVisible();
  await page.getByRole('button', { name: /Generate AI summary/ }).click();
  await expect(
    page.getByText('Latest HbA1c is 6.8%, down from 7.4% at the previous test.'),
  ).toBeVisible();
  await expect(page.getByText('AI summary · check sources')).toBeVisible();
  await expect(page.getByText(/For your review/)).toBeVisible();
  await shot(page, '07-doctor-ai-brief');
});

test('a doctor outside the care team sees an explained denial', async ({ page }) => {
  await quickSignIn(page, /Arjun Reddy/);
  await page.getByRole('tab', { name: /All patients/ }).click();
  await page
    .getByRole('row', { name: /Ananya Rao/ })
    .getByRole('link', { name: 'Open' })
    .click();
  await expect(page.getByText('NO_CARE_RELATIONSHIP').first()).toBeVisible();
  await shot(page, '08-doctor-denied');
});

test('organization admin sees counts and audit, not clinical data', async ({ page }) => {
  await quickSignIn(page, /Kavya Iyer/);
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(
    page.getByText('Administrators see counts and audit records, never clinical data.'),
  ).toBeVisible();
  await expect(page.getByText('Recent audit events')).toBeVisible();
  await shot(page, '09-admin-dashboard');
});

test('patient view works on a phone @mobile', async ({ page }) => {
  await quickSignIn(page, /Ananya Rao/);
  await expect(page.getByText('92%')).toBeVisible();
  await shot(page, '10-mobile-dashboard');
});
