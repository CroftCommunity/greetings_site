// Pure auth logic — no browser or SDK imports, so it unit-tests headless. The
// OAuth client construction + session live in ./auth.ts (which imports this).

/** The origin whose hosted client-metadata.json this build carries. Sign-in is
 * offered only here (the OAuth client_id must equal the hosted URL) or on
 * loopback; every other origin degrades to read-only. */
export const PRODUCTION_ORIGIN = 'https://greetings.croft.ing';

/** OAuth scope: bare `atproto` cannot call appview-proxied RPCs; the transition
 * scope grants generic write (createRecord/uploadBlob) for the MVP. */
export const OAUTH_SCOPE = 'atproto transition:generic';

export type AuthMode = 'loopback' | 'hosted' | 'none';

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Which OAuth client (if any) this origin can run: loopback (local dev) → the
 * atproto loopback client; the production origin → the hosted client-metadata
 * document; anything else → none (client_id/redirect would not match → the app
 * is read-only, never crashes).
 */
export function authModeFor(origin: string, hostname: string): AuthMode {
  if (isLoopbackHostname(hostname)) return 'loopback';
  if (origin === PRODUCTION_ORIGIN) return 'hosted';
  return 'none';
}

/** Normalize a user-typed handle: trim, strip a leading @, lowercase. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

/** Whether a `location.search` string is an OAuth authorization-code callback
 * (both `code` and `state` present) — used to show a "finishing sign-in" state
 * while the client completes the exchange on load. */
export function isOAuthCallback(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('code') && params.has('state');
}
