import { test, expect } from '@playwright/test';
import { PROVIDERS, SIGNUP } from '../../src/signin/providers';

// @live: do the registered providers still exist, still speak OAuth, and still
// have the signup posture we claim? The registry is hardcoded on purpose (the
// view paints synchronously); the drift lives here, as in forage and croft-pwa.
// Runs only via `npm run test:live`, never in push CI (playwright.config grep).
// A host that is DOWN and a host that CHANGED are different findings: the first
// is not our regression, so it skips rather than fails.
for (const p of PROVIDERS) {
  test(`@live ${p.id}: ${p.entryway} still matches the registry`, async ({ request }) => {
    const desc = await request.get(`${p.entryway}/xrpc/com.atproto.server.describeServer`, { timeout: 15_000 });
    test.skip(!desc.ok(), `${p.id} unreachable (describeServer ${desc.status()}) — not our regression`);
    const d = (await desc.json()) as { inviteCodeRequired?: boolean };
    const posture = d.inviteCodeRequired ? SIGNUP.INVITE : SIGNUP.OPEN;
    expect(posture, `${p.id}: we say '${p.signups}', the server says '${posture}' — update src/signin/providers.json`).toBe(p.signups);

    const oauth = await request.get(`${p.entryway}/.well-known/oauth-authorization-server`, { timeout: 15_000 });
    expect(oauth.ok(), `${p.id}: no oauth-authorization-server (${oauth.status()})`).toBe(true);
    const meta = (await oauth.json()) as { prompt_values_supported?: string[]; scopes_supported?: string[] };
    expect(meta.prompt_values_supported ?? [], `${p.id}: no longer advertises prompt=create`).toContain('create');
    expect(meta.scopes_supported ?? [], `${p.id}: dropped the transition:generic scope`).toContain('transition:generic');
  });
}
