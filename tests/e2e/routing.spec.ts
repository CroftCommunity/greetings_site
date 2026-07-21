import { test, expect } from '@playwright/test';

// Wiring tests for Phase 1b: prove the entry point (index.html -> main.ts ->
// router -> views) is live against the BUILT bundle served from dist/. These run
// in CI / a browser-capable env (playwright), not in the unit sandbox. `#app`'s
// data-view attribute is the router's stable output marker.

test('home route renders the home view', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'home');
  await expect(page.getByRole('heading', { name: 'greetings' })).toBeVisible();
});

test('#/create renders the create shell', async ({ page }) => {
  await page.goto('/#/create');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'create');
});

test('a well-formed card locator renders the card shell (not a 404)', async ({ page }) => {
  await page.goto('/#/c/did:plc:example/abc123');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'card');
});

test('a malformed card locator renders the notfound state, not a crash', async ({ page }) => {
  await page.goto('/#/c/');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'notfound');
});

test('in-app navigation updates the view on hashchange', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create a greeting' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'create');
});

test('the PWA manifest is linked, valid, and carries an icon', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('link[rel="manifest"]');
  await expect(link).toHaveCount(1);
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  const res = await page.request.get(new URL(href ?? '', page.url()).toString());
  expect(res.ok()).toBeTruthy();
  const manifest = (await res.json()) as { name?: string; icons?: unknown[] };
  expect(manifest.name).toBe('greetings');
  expect(manifest.icons?.length ?? 0).toBeGreaterThan(0);
});
