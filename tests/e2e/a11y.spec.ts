import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility scan. Adopts the workspace standard — canonical writeup
// in croft-pwa/docs/ACCESSIBILITY.md.
// Every routed view must have zero serious/critical axe violations.
//
// HERMETIC by construction: all cross-origin requests are blocked. This app talks
// to a real PDS, so without the block a runner with network renders a different
// DOM than CI does and the scan's green is not a statement about the same page.
//
// Scanned as the ROUTED VIEWS rather than as pages: the app is a single shell with
// a hash router, so `#app[data-view]` is the surface that actually differs. Waiting
// on that attribute is also the settled-DOM requirement — at `load` the router has
// not mounted a view yet and axe would grade an empty shell.
const VIEWS = [
  { path: '/', view: 'home' },
  { path: '/#/create', view: 'create' },
  { path: '/#/c/did:plc:example/abc123', view: 'card' },
  { path: '/#/c/', view: 'notfound' },
];

// BOTH themes, always: contrast is theme-dependent, and a light-only scan cannot
// see a dark-only failure. Concretely here — white text clears AA on the light
// accent and FAILS on the dark one, which is why --on-accent has two values.
for (const { path, view } of VIEWS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`a11y: ${view} view (${theme}) — no serious/critical violations`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('theme', t);
        } catch {
          /* private mode — the pre-paint script falls back to the OS preference */
        }
      }, theme);
      await page.route('**/*', (route) => {
        const host = new URL(route.request().url()).hostname;
        if (host === 'localhost' || host === '127.0.0.1') void route.continue();
        else void route.abort();
      });
      await page.goto(path);
      await expect(page.locator('#app')).toHaveAttribute('data-view', view);

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);

      expect(blocking, blocking.join(' · ')).toEqual([]);
    });
  }
}
