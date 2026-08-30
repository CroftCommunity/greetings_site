import { test, expect } from '@playwright/test';

// Phase 2 wiring: on loopback (the e2e origin), sign-in is offered, so the
// signed-out create view shows the sign-in step (the provider panels —
// tests/e2e/signin.spec.ts owns their behaviour). The interactive OAuth
// round-trip (redirect + consent) is verified manually in a browser — not
// automated here — so these assert the surface is reachable without leaving
// the app.

test('the signed-out create view shows the sign-in step', async ({ page }) => {
  await page.goto('/#/create');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'create');
  await expect(page.locator('[data-signin]')).toBeVisible();
  await expect(page.locator('[data-provider-row="bsky"] [data-provider-signin]')).toBeVisible();
});

test('the hosted OAuth client-metadata.json is served and well-formed', async ({ page }) => {
  const res = await page.request.get('/client-metadata.json');
  expect(res.ok()).toBeTruthy();
  const meta = (await res.json()) as {
    client_id?: string;
    redirect_uris?: string[];
    scope?: string;
    dpop_bound_access_tokens?: boolean;
  };
  expect(meta.client_id).toContain('/client-metadata.json');
  expect(meta.redirect_uris?.length).toBeGreaterThan(0);
  expect(meta.scope).toContain('atproto');
  expect(meta.dpop_bound_access_tokens).toBe(true);
});
