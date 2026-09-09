import { expect, test } from '@playwright/test';

function captureBrowserErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    const isExpectedInvalidLoginResourceError = message.type() === 'error'
      && /^Failed to load resource: the server responded with a status of 401\b/.test(message.text());
    if (message.type() === 'error' && !isExpectedInvalidLoginResourceError) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('unauthenticated users are redirected and invalid credentials show the live API error', async ({ page }) => {
  const errors = captureBrowserErrors(page);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Secure access' })).toBeVisible();

  const invalidLogin = page.waitForResponse((response) => (
    response.url().includes('/api/v1/auth/login')
    && response.request().method() === 'POST'
  ));
  await page.getByLabel('Email address').fill('coordinator@example.com');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  expect((await invalidLogin).status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(errors).toEqual([]);
  });

  test('coordinator signs in through the live API and reaches a shell-backed dashboard', async ({ page }) => {
  const errors = captureBrowserErrors(page);

  await page.goto('/login');
  const loginResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/auth/login')
    && response.request().method() === 'POST'
    && response.status() === 200
  ));
  const dashboardResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/dashboard')
    && response.request().method() === 'GET'
    && response.status() === 200
  ));

  await page.getByLabel('Email address').fill('coordinator@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const login = await loginResponse;
  expect((await login.json()).role).toBe('coordinator');
  const dashboard = await dashboardResponse;
  const payload = await dashboard.json();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Member panel' })).toBeVisible();
  const membersAssignedCard = page.getByText('Members assigned', { exact: true }).locator('..');
  await expect(membersAssignedCard.getByText(String(payload.metrics.members_assigned), { exact: true })).toBeVisible();
  await page.screenshot({ path: 'e2e-results/screenshots/auth-dashboard.png', fullPage: true });
  expect(errors).toEqual([]);
});
