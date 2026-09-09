import { expect, test } from '@playwright/test';

test('coordinator signs in through the live API and reaches confirmation', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email address').fill('coordinator@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome, Care Coordinator.' })).toBeVisible();
  await expect(page.getByText('coordinator role', { exact: false })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
