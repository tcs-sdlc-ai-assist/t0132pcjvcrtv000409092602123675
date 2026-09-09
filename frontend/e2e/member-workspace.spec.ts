import { expect, test } from '@playwright/test';

/** Exercise the signed-in member panel and care-work journey against live services. */
test('coordinator searches a member and documents care work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login'); await page.getByLabel('Email').fill('coordinator@example.com'); await page.getByLabel('Password').fill('CareDemo1!'); await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Member panel' })).toBeVisible(); await page.getByLabel('Search members').fill('Member1'); await page.getByRole('link', { name: 'Open' }).first().click();
  await expect(page.getByText('SSN')).toBeVisible(); await page.getByLabel('Closure reason').fill('Verified in chart'); await page.getByRole('button', { name: 'Close gap' }).click();
  expect(errors).toEqual([]);
});