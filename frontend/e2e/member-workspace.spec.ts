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

async function signInAndOpenPanel(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('coordinator@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const panelResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members')
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Member panel' }).click();
  await panelResponse;
}

test('live panel sorting requests PCP and last-outreach ordering', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill('supervisor@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const panelResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members')
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Member panel' }).click();
  await panelResponse;
  await expect(page.getByRole('heading', { name: 'Member panel' })).toBeVisible();

  const pcpSortResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('sort_by') === 'pcp'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('button', { name: 'PCP' }).click();
  expect((await pcpSortResponse).status()).toBe(200);
  await expect(page.getByRole('columnheader', { name: 'PCP' })).toHaveAttribute('aria-sort', 'ascending');

  const outreachSortResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('sort_by') === 'last_outreach'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('button', { name: 'Last outreach' }).click();
  expect((await outreachSortResponse).status()).toBe(200);
  await expect(page.getByRole('columnheader', { name: 'Last outreach' })).toHaveAttribute('aria-sort', 'ascending');
  expect(errors).toEqual([]);
});

test('coordinator filters, opens a live member, and persists outreach, goal, and close-gap mutations', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await signInAndOpenPanel(page);

  await expect(page.getByRole('heading', { name: 'Member panel' })).toBeVisible();
  const pcpSortResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('sort_by') === 'pcp'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('button', { name: 'PCP' }).click();
  expect((await pcpSortResponse).status()).toBe(200);
  await expect(page.getByRole('columnheader', { name: 'PCP' })).toHaveAttribute('aria-sort', 'ascending');

  const outreachSortResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('sort_by') === 'last_outreach'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('button', { name: 'Last outreach' }).click();
  expect((await outreachSortResponse).status()).toBe(200);
  await expect(page.getByRole('columnheader', { name: 'Last outreach' })).toHaveAttribute('aria-sort', 'ascending');

  const filteredResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && response.url().includes('query=definitely-no-meridian-member')
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByLabel('Search members').fill('definitely-no-meridian-member');
  await filteredResponse;
  await expect(page.getByText('No members match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('link', { name: 'Open' }).first()).toBeVisible();

  const riskResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('risk_level') === 'high'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByLabel('Risk').selectOption('high');
  const riskPanel = await riskResponse;
  expect(await riskPanel.json()).toMatchObject({ items: expect.any(Array) });

  const planResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('plan') === 'Meridian Choice'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByLabel('Plan').selectOption('Meridian Choice');
  const planPanel = await planResponse;
  expect(await planPanel.json()).toMatchObject({ items: expect.any(Array) });

  const gapFilterResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('open_gap_min') === '1'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByLabel('Minimum open gaps (current page)').selectOption('1');
  const gapPanel = await gapFilterResponse;
  expect(await gapPanel.json()).toMatchObject({ items: expect.any(Array) });

  await page.getByRole('button', { name: 'Open gaps' }).click();
  await expect(page.getByRole('columnheader', { name: 'Open gaps' })).toHaveAttribute('aria-sort', 'ascending');

  const detailResponse = page.waitForResponse((response) => (
    /\/api\/v1\/members\/\d+$/.test(new URL(response.url()).pathname)
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Open' }).first().click();
  const detail = await detailResponse;
  const member = await detail.json();
  await expect(page.getByText(member.member_key)).toBeVisible();

  const goal = member.care_plan_goals[0];
  if (goal) {
    const goalResponse = page.waitForResponse((response) => (
      response.url().endsWith(`/care-plan/${goal.id}`)
      && response.request().method() === 'PATCH'
      && response.status() === 200
    ));
    await page.getByLabel(`Goal status for ${goal.title}`).selectOption('met');
    expect((await goalResponse).status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel(`Goal status for ${goal.title}`)).toHaveValue('met');
  }

  const openGap = member.gaps.find((gap: { status: string }) => gap.status === 'open');
  if (openGap) {
    const gapResponse = page.waitForResponse((response) => (
      response.url().endsWith(`/gaps/${openGap.id}/close`)
      && response.request().method() === 'POST'
      && response.status() === 200
    ));
    await page.getByLabel('Closure reason').fill('Verified in chart');
    await page.getByRole('button', { name: 'Close gap' }).click();
    expect((await gapResponse).status()).toBe(200);
    await page.reload();
    await expect(page.getByText(/Verified in chart/)).toBeVisible();
  }

  const outreachResponse = page.waitForResponse((response) => (
    response.url().endsWith('/outreach')
    && response.request().method() === 'POST'
    && response.status() === 201
  ));
  await page.getByLabel('Channel').selectOption('SMS');
  await page.getByLabel('Outcome').selectOption('left message');
  await page.getByLabel('Outreach notes').fill('Left a callback message during live end-to-end check');
  await page.getByRole('button', { name: 'Log outreach' }).click();
  const outreach = await outreachResponse;
  expect(await outreach.json()).toMatchObject({ channel: 'SMS', outcome: 'left message', notes: 'Left a callback message during live end-to-end check' });
  await page.reload();
  await expect(page.getByText('Left a callback message during live end-to-end check')).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByRole('link', { name: 'Back to panel' })).toBeVisible();
  await page.screenshot({ path: 'e2e-results/screenshots/member-tablet.png', fullPage: true });
  expect(errors).toEqual([]);
  });

test('supervisor can unassign a member and observe the persisted assignment', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill('supervisor@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const panelResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members')
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Member panel' }).click();
  await panelResponse;

  const coordinatorResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members?')
    && new URL(response.url()).searchParams.get('coordinator_id') === '1'
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByLabel('Coordinator ID').fill('1');
  const coordinatorPanel = await coordinatorResponse;
  expect(await coordinatorPanel.json()).toMatchObject({ items: expect.any(Array) });

  const detailResponse = page.waitForResponse((response) => (
    /\/api\/v1\/members\/\d+$/.test(new URL(response.url()).pathname)
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Open' }).first().click();
  const member = await (await detailResponse).json();

  const assignmentResponse = page.waitForResponse((response) => (
    response.url().endsWith(`/members/${member.id}/assignment`)
    && response.request().method() === 'PATCH'
    && response.status() === 200
  ));
  await page.getByLabel(/Assign coordinator ID/).fill('');
  await page.getByRole('button', { name: 'Save assignment' }).click();
  const assignment = await assignmentResponse;
  expect(await assignment.json()).toMatchObject({ id: member.id, assigned_coordinator_id: null });
  await page.reload();
  await expect(page.getByText('Unassigned')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/screenshots/supervisor-assignment.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('auditor can read the member panel but cannot access care-work controls', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/login');
  const loginResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/auth/login')
    && response.request().method() === 'POST'
    && response.status() === 200
  ));
  await page.getByLabel('Email address').fill('auditor@example.com');
  await page.getByLabel('Password').fill('CareDemo1!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await (await loginResponse).json()).role).toBe('auditor');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const panelResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/members')
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Member panel' }).click();
  expect((await panelResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Member panel' })).toBeVisible();

  const detailResponse = page.waitForResponse((response) => (
    /\/api\/v1\/members\/\d+$/.test(new URL(response.url()).pathname)
    && response.request().method() === 'GET'
    && response.status() === 200
  ));
  await page.getByRole('link', { name: 'Open' }).first().click();
  const member = await (await detailResponse).json();
  await expect(page.getByRole('button', { name: 'Log outreach' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close gap' })).toHaveCount(0);
  for (const goal of member.care_plan_goals) {
    await expect(page.getByRole('combobox', { name: `Goal status for ${goal.title}` })).toHaveCount(0);
    await expect(page.getByLabel(`Goal status for ${goal.title}`)).toHaveText(
      `Goal status: ${goal.status === 'not-started' ? 'Not started' : goal.status === 'in-progress' ? 'In progress' : 'Met'}`,
    );
  }
  await page.screenshot({ path: 'e2e-results/screenshots/auditor-read-only-member.png', fullPage: true });
  expect(errors).toEqual([]);
});
