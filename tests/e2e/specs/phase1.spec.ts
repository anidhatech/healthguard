/**
 * The Phase 1 demo script, checkpoint by checkpoint, through the real UI.
 * Each test resets the demo data first, so the order of tests does not matter.
 */
import { expect, test } from '@playwright/test';
import { quickSignIn, resetDemo, shot } from './helpers';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterAll(async () => {
  await resetDemo(92);
});

test('day 0: the doctor prescribes; an allergy blocks signing; instructions in 3 languages', async ({
  page,
}) => {
  await resetDemo(0, '11:05');
  await quickSignIn(page, /Dr\. Meera Sharma/);
  await page
    .getByRole('row', { name: /Ananya Rao/ })
    .getByRole('link', { name: 'Open' })
    .click();
  await expect(page.getByRole('heading', { name: 'Ananya Rao' })).toBeVisible();

  // Penicillin allergy: amoxicillin cannot be signed.
  await page.getByRole('button', { name: 'Prescribe' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Medicine').selectOption({ label: 'Amoxicillin 500 mg (capsule)' });
  await dialog.getByLabel('Days (empty = ongoing)').fill('5');
  await dialog.getByLabel(/^For/).fill('Infection');
  await dialog.getByRole('button', { name: 'Save draft and run checks' }).click();
  await expect(dialog.getByText(/Recorded allergy: Penicillin/)).toBeVisible();
  await expect(
    dialog.getByText('A blocking check failed. This draft cannot be signed.'),
  ).toBeVisible();
  await shot(page, '11-prescribe-allergy-block');
  await dialog.getByRole('button', { name: 'Discard draft' }).click();
  await page.keyboard.press('Escape');

  // Metformin: checks pass; the prescriber reads every language and signs.
  await page.getByRole('button', { name: 'Prescribe' }).click();
  await dialog.getByLabel('Medicine').selectOption({ label: 'Metformin 500 mg (tablet)' });
  await dialog.getByLabel(/^For/).fill('Blood sugar');
  await dialog.getByLabel('Take with food').check();
  await dialog.getByRole('button', { name: 'Save draft and run checks' }).click();
  await expect(
    dialog.getByText('ఉదయం టిఫిన్ చేసిన 15 నిమిషాల తర్వాత Metformin 500 mg 1 టాబ్లెట్ తీసుకోండి.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(dialog.getByText('नाश्ता करने के 15 मिनट बाद', { exact: false })).toBeVisible();
  const sign = dialog.getByRole('button', { name: 'Sign' });
  await expect(sign).toBeDisabled();
  await dialog.getByText('I have read the instruction in every language').click();
  await shot(page, '12-prescribe-review');
  await sign.click();
  await expect(dialog.getByText(/Signed\. Doses start tomorrow/)).toBeVisible();
});

test('day 6: reminders on the simulated phone, taken / snooze, and Need help', async ({ page }) => {
  await resetDemo(6, '07:40');
  await quickSignIn(page, /Ananya Rao/);
  await expect(page).toHaveURL(/\/patient\/dashboard/);
  await expect(page.getByRole('heading', { name: 'ఈరోజు మందులు' })).toBeVisible();
  await expect(page.getByText('మందుల గుర్తు').first()).toBeVisible();
  await shot(page, '13-patient-today-doses');

  const doses = page.locator('section[aria-labelledby="today-doses"] li');
  await doses.first().getByRole('button', { name: 'వేసుకున్నాను' }).click();
  await expect(doses.first().getByText('వేసుకున్నారు')).toBeVisible();
  await doses.nth(1).getByRole('button', { name: '30 నిమి.' }).click();
  await expect(doses.nth(1).getByText('వాయిదా')).toBeVisible();

  await page.getByRole('button', { name: 'సహాయం కావాలి' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: /112/ })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /108/ })).toBeVisible();
  await dialog.getByText('మందు వల్ల దుష్ప్రభావం ఉందనిపిస్తోంది').click();
  await shot(page, '14-patient-need-help');
  await dialog.getByRole('button', { name: 'తిరిగి ఫోన్ చేయమని అడగండి' }).click();
  await expect(dialog.getByText('అభ్యర్థన పంపాం. మీ కేర్ టీమ్ మీకు ఫోన్ చేస్తుంది.')).toBeVisible();

  // The care coordinator sees the request and logs the call.
  await page.context().clearCookies();
  await quickSignIn(page, /Ravi Kumar/);
  await page.goto('/doctor/dashboard');
  await page.locator('header select').selectOption('en-IN');
  await expect(page.getByRole('heading', { name: 'Care queue' })).toBeVisible();
  await expect(page.getByText(/Patient asked for a call back: possible side effect/)).toBeVisible();
  await shot(page, '15-care-queue');
  await page.getByRole('button', { name: 'Log call' }).first().click();
  await page.getByRole('button', { name: 'Called — resolved' }).click();
  await expect(page.getByText(/Patient asked for a call back: possible side effect/)).toHaveCount(
    0,
  );
  await page.locator('header select').selectOption('hi-IN');
  await page.waitForLoadState('networkidle');
});

test('day 85: the patient checks values read from a report', async ({ page }) => {
  await resetDemo(85, '10:00');
  await quickSignIn(page, /Ananya Rao/);
  await page.locator('header select').selectOption('en-IN');
  await page.goto('/patient/tests');
  await expect(page.getByText('Check the values read from your report')).toBeVisible();
  for (const row of await page.getByRole('radio', { name: 'Matches' }).all()) await row.click();
  await shot(page, '16-patient-confirm-report');
  await page.getByRole('button', { name: 'Save my check' }).click();
  await expect(page.getByText('Thank you. Your check is saved.')).toBeVisible();
  await page.locator('header select').selectOption('te-IN');
  await page.waitForLoadState('networkidle');
});

test('day 88: the patient approves the proposed visit, the care team confirms', async ({
  page,
}) => {
  await resetDemo(88, '18:00');
  await quickSignIn(page, /Ananya Rao/);
  await page.locator('header select').selectOption('en-IN');
  await page.goto('/patient/appointments');
  await expect(page.getByText('Waiting for your approval')).toBeVisible();
  await shot(page, '17-patient-approve-appointment');
  await page.getByRole('button', { name: 'Approve this time' }).click();
  await expect(page.getByText('You approved this time. The clinic will confirm it.')).toBeVisible();
  await page.locator('header select').selectOption('te-IN');
  await page.waitForLoadState('networkidle');

  await page.context().clearCookies();
  await quickSignIn(page, /Ravi Kumar/);
  await page.locator('header select').selectOption('en-IN');
  await page.goto('/doctor/dashboard');
  await page.getByRole('tab', { name: /All patients/ }).click();
  await page
    .getByRole('row', { name: /Ananya Rao/ })
    .getByRole('link', { name: 'Open' })
    .click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Confirmed').first()).toBeVisible();
  await page.locator('header select').selectOption('hi-IN');
  await page.waitForLoadState('networkidle');
});

test('day 92: AI observation review, FHIR export, ABDM simulation, demo console', async ({
  page,
}) => {
  await resetDemo(92, '11:00');
  await quickSignIn(page, /Dr\. Meera Sharma/);
  await page.getByRole('link', { name: 'Open' }).first().click();
  await page.getByRole('button', { name: /Generate AI summary/ }).click();
  await expect(page.getByText(/For your review/)).toBeVisible();
  await page.getByRole('button', { name: 'Noted' }).first().click();
  await expect(page.getByText('Noted by you').first()).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download FHIR file' }).click();
  expect((await download).suggestedFilename()).toMatch(/SYNTHETIC\.json$/);
  await shot(page, '18-doctor-review');

  await page.context().clearCookies();
  await quickSignIn(page, /Ananya Rao/);
  await page.locator('header select').selectOption('en-IN');
  await page.goto('/patient/profile');
  await expect(page.getByText('SIMULATED — not connected to ABDM').first()).toBeVisible();
  await page.getByRole('button', { name: 'Link (simulation)' }).click();
  await expect(page.getByText('Linked as ananya.demo@simulated')).toBeVisible();
  await page.getByRole('button', { name: 'Preview what would be shared' }).click();
  await expect(page.getByText(/Nothing was sent\./)).toBeVisible();
  await shot(page, '19-patient-abdm-simulation');
  await page.locator('header select').selectOption('te-IN');
  await page.waitForLoadState('networkidle');

  await page.context().clearCookies();
  await quickSignIn(page, /Kavya Iyer/);
  await expect(page.getByRole('heading', { name: 'Demo console' })).toBeVisible();
  await expect(page.getByText('Day 92 — follow-up visit')).toBeVisible();
  await shot(page, '20-admin-demo-console');
});
