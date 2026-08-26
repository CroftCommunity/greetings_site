import { test, expect } from '@playwright/test';

// Mobile-first, tap-first: nothing may overflow horizontally on a phone.
// Workspace standard — canonical in croft-pwa/docs/MOBILE-FIRST.md, index at
// CroftC/.claude/MOBILE-FIRST.md.
//
// Widths: 320 = small Android / older iPhone (the one that actually breaks),
// 360 = common Android, 390 = modern iPhone. Testing only 390 finds almost nothing.
//
// Measured with documentElement.scrollWidth, which is sound HERE because nothing
// in styles.css clips overflow-x. If a clip is ever added as a safety net, this
// assertion silently becomes unfalsifiable and must switch to per-element
// getBoundingClientRect — see the canonical doc, § "Measuring overflow".
const WIDTHS = [320, 360, 390];
const VIEWS = [
  { path: '/', view: 'home' },
  { path: '/#/create', view: 'create' },
  { path: '/#/c/did:plc:example/abc123', view: 'card' },
];

for (const width of WIDTHS) {
  for (const { path, view } of VIEWS) {
    test(`no horizontal overflow: ${view} at ${width}px`, async ({ page }) => {
      await page.route('**/*', (route) => {
        const host = new URL(route.request().url()).hostname;
        if (host === 'localhost' || host === '127.0.0.1') void route.continue();
        else void route.abort();
      });
      await page.setViewportSize({ width, height: 780 });
      await page.goto(path);
      await expect(page.locator('#app')).toHaveAttribute('data-view', view);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // <=1 absorbs sub-pixel rounding; a real bleed is tens of pixels.
      expect(overflow, `${view} @ ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }
}

// Touch targets: >=44x44 CSS px (WCAG 2.5.5, the workspace floor). Asserted on the
// PADDED hit area — for an icon-only control the fix is padding, not a bigger glyph.
test('interactive controls clear the 44px tap floor on a phone', async ({ page }) => {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') void route.continue();
    else void route.abort();
  });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'home');

  const undersized = await page.evaluate(() => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button]';
    return Array.from(document.querySelectorAll(sel))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cls = el instanceof HTMLElement && el.className ? `.${el.className.split(' ')[0]}` : '';
        return `${el.tagName.toLowerCase()}${cls} ${Math.round(r.width)}×${Math.round(r.height)}`;
      });
  });
  expect(undersized, undersized.join(' · ')).toEqual([]);
});
