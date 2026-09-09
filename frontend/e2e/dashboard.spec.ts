import { expect, test } from '@playwright/test';

test('coordinator dashboard renders live scoped measures after sign-in', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill('coordinator@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Members assigned')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Open care gaps by type' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
