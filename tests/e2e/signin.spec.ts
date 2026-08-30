import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROVIDERS, featuredProviders, otherProviders, ATMO_GLOSS } from '../../src/signin/providers';

// The signed-out create view IS the sign-in step (the whole page is "choose your
// provider"), so the pattern renders inline as two panels rather than as a sheet —
// the sheet is the recorded exception to "pages, not modals", not a mandate
// (croft-pwa/docs/DESIGN.md § Components › Navigation law, § Flows › Sign in).
//
// Intent is spied at the seam main.ts uses: the real signIn(handle, options) is
// replaced on window before the app boots, via the test hook auth.ts exposes.
const OPEN = featuredProviders();
const INVITE = otherProviders();

const rows = (page: Page, within: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} [data-provider-row]`)].map((r) => ({
        id: r.getAttribute('data-provider-row'),
        create: !!r.querySelector('[data-provider-create]'),
        signin: !!r.querySelector('[data-provider-signin]'),
        visible: r.getClientRects().length > 0,
        text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      })),
    within,
  );

async function hermetic(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') void route.continue();
    else void route.abort();
  });
}

async function spy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __signInCalls: unknown[]; __greetingsSignIn?: unknown };
    w.__signInCalls = [];
    w.__greetingsSignIn = (target: string, options?: unknown) => {
      w.__signInCalls.push({ target, options: options ?? null });
      return new Promise(() => {});
    };
  });
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __signInCalls: unknown[] }).__signInCalls);

test.beforeEach(async ({ page }) => {
  await hermetic(page);
  await spy(page);
});

test('the registry carries both postures, or this spec proves nothing', () => {
  expect(OPEN.length).toBeGreaterThan(0);
  expect(INVITE.length).toBeGreaterThan(0);
  expect(PROVIDERS.map((p) => p.id).sort()).toEqual(['blacksky', 'bsky', 'eurosky', 'northsky']);
});

test('the signed-out create view asks for an atmo provider, glossed, with the definition in sight', async ({ page }) => {
  await page.goto('/#/create');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'create');
  const h = page.locator('[data-signin] h2');
  await expect(h).toHaveText('Choose your atmo provider');
  await expect(h.locator('abbr')).toHaveAttribute('title', ATMO_GLOSS);
  await expect(page.locator('[data-signin] p').first()).toContainText('Personal Data Server');
});

test('front page = open providers with Create + Sign in; invite-only behind Another provider', async ({ page }) => {
  await page.goto('/#/create');
  const front = await rows(page, '[data-signin] > .signin-list');
  expect(front.map((r) => r.id)).toEqual(OPEN.map((p) => p.id));
  for (const r of front) expect(r.visible && r.create && r.signin, JSON.stringify(r)).toBe(true);
  for (const p of INVITE) expect(front.some((r) => r.id === p.id)).toBe(false);

  const hidden = await rows(page, '.signin-other');
  expect(hidden.map((r) => r.id)).toEqual(INVITE.map((p) => p.id));
  expect(hidden.every((r) => !r.visible)).toBe(true);
  await expect(page.locator('input[name="handle"]')).toBeHidden();

  await page.locator('[data-provider-other]').click();
  await expect(page.locator('[data-provider-other]')).toBeHidden();
  for (const r of await rows(page, '.signin-other')) {
    expect(r.visible).toBe(true);
    expect(r.create, `${r.id} is invite-only — Create would land on a screen demanding a code`).toBe(false);
    expect(r.signin).toBe(true);
    expect(r.text).toMatch(/invite only/i);
  }
  await expect(page.locator('input[name="handle"]')).toBeFocused();
});

test('Create sends prompt=create at that entryway; Sign in sends no options', async ({ page }) => {
  const p = OPEN[0];
  if (!p) throw new Error('no open provider');
  await page.goto('/#/create');
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-create]`).click();
  expect(await calls(page)).toEqual([{ target: p.entryway, options: { prompt: 'create' } }]);
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-signin]`).click();
  expect(await calls(page)).toEqual([
    { target: p.entryway, options: { prompt: 'create' } },
    { target: p.entryway, options: null },
  ]);
});

test('an invite-only provider signs in at its entryway from the other panel', async ({ page }) => {
  const p = INVITE[0];
  if (!p) throw new Error('no invite provider');
  await page.goto('/#/create');
  await page.locator('[data-provider-other]').click();
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-signin]`).click();
  expect(await calls(page)).toEqual([{ target: p.entryway, options: null }]);
});

test('a handle on any other provider reaches the same seam, leading @ stripped; empty is refused', async ({ page }) => {
  await page.goto('/#/create');
  await page.locator('[data-provider-other]').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/#\/create$/);
  expect(await calls(page)).toEqual([]);
  await page.locator('input[name="handle"]').fill('@someone.zio.blue');
  await page.getByRole('button', { name: 'Continue' }).click();
  expect(await calls(page)).toEqual([{ target: 'someone.zio.blue', options: null }]);
});

test('fits the narrowest phone with the other panel open: no sideways scroll, every control ≥44px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#/create');
  await page.locator('[data-provider-other]').click();
  const fit = await page.evaluate(() => {
    const small = [...document.querySelectorAll('[data-signin] button, [data-signin] input')]
      .map((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return r.width < 44 || r.height < 44 ? `${(b as HTMLElement).innerText || b.tagName} ${Math.round(r.width)}x${Math.round(r.height)}` : null;
      })
      .filter(Boolean);
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small };
  });
  expect(fit.overflow).toBeLessThanOrEqual(1);
  expect(fit.small).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`a11y: create view with the other panel revealed (${theme}) — no serious/critical violations`, async ({ page }) => {
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t);
      } catch {
        /* private mode */
      }
    }, theme);
    await page.goto('/#/create');
    await page.locator('[data-provider-other]').click();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);
    expect(blocking, blocking.join(' · ')).toEqual([]);
  });
}
