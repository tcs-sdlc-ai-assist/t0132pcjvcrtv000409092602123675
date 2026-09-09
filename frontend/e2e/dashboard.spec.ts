import { expect, test } from '@playwright/test';

function captureBrowserErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('coordinator@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('dashboard exposes real scoped measures, observable loading, responsive navigation, and a persistent theme', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  let releaseDashboardResponse: (() => void) | undefined;
  const dashboardResponseGate = new Promise<void>((resolve) => {
    releaseDashboardResponse = resolve;
  });
  let dashboardRequestStarted: (() => void) | undefined;
  const dashboardRequestPending = new Promise<void>((resolve) => {
    dashboardRequestStarted = resolve;
  });
  await page.route('**/api/v1/dashboard', async (route) => {
    const response = await route.fetch();
    dashboardRequestStarted?.();
    await dashboardResponseGate;
    await route.fulfill({ response });
  });

  await signIn(page);
  await dashboardRequestPending;
  await expect(page.getByRole('status', { name: 'Loading dashboard' })).toBeVisible();
  releaseDashboardResponse?.();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Member panel' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Member panel' })).toBeVisible();
  await page.screenshot({ path: 'e2e-results/screenshots/dashboard-mobile-dark.png', fullPage: true });
  expect(errors).toEqual([]);
});
