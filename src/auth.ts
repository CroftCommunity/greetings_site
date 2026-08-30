// Creator OAuth (Phase 2). atproto OAuth in the browser via
// @atproto/oauth-client-browser (DPoP + PAR + PKCE), reusing arecipe's proven
// pattern: a hosted client-metadata.json on the production origin, atproto's
// loopback client on local dev, read-only everywhere else. The library owns
// session persistence (IndexedDB) and completes the OAuth callback in init();
// this module adds no storage of its own.
import { Agent } from '@atproto/api';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { atprotoLoopbackClientMetadata, type OAuthClientMetadataInput } from '@atproto/oauth-types';
import { authModeFor, OAUTH_SCOPE, type AuthMode } from './auth-core.js';
import clientMetadataJson from '../client-metadata.json';

// The hosted client-metadata document, served verbatim at
// `${PRODUCTION_ORIGIN}/client-metadata.json` (build.mjs copies it into dist).
// The auth server fetches that URL to verify, so the two must match byte for byte.
const HOSTED_CLIENT_METADATA = clientMetadataJson as OAuthClientMetadataInput;
const HANDLE_RESOLVER = 'https://bsky.social';

/** What the create view needs to render. */
export type AuthState = {
  mode: AuthMode;
  agent: Agent | null;
  /** The signed-in creator's DID (repo to write to), or null. */
  did: string | null;
  /** Handle for display, or the DID if the handle could not be resolved. */
  who: string | null;
};

/** Loopback client metadata: one client_id with the origin-root redirect_uri +
 * scope baked in (the redirect must be an IP literal, never `localhost`). */
function buildLoopbackMetadata(loc: Location): OAuthClientMetadataInput {
  const host = loc.hostname === 'localhost' ? '127.0.0.1' : loc.hostname;
  const authority = `http://${host}${loc.port === '' ? '' : `:${loc.port}`}`;
  const clientId =
    `http://localhost?redirect_uri=${encodeURIComponent(`${authority}/`)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPE)}`;
  return atprotoLoopbackClientMetadata(clientId);
}

let client: BrowserOAuthClient | null = null;
let currentSession: { did: string; signOut: () => Promise<void> } | null = null;

function getClient(): BrowserOAuthClient | null {
  const mode = authModeFor(location.origin, location.hostname);
  if (mode === 'none') return null;
  if (client === null) {
    const metadata = mode === 'hosted' ? HOSTED_CLIENT_METADATA : buildLoopbackMetadata(location);
    client = new BrowserOAuthClient({ handleResolver: HANDLE_RESOLVER, clientMetadata: metadata });
  }
  return client;
}

/** Restore an existing session or complete an OAuth callback on load. Never
 * throws to the caller — auth failure surfaces as read-only + a console
 * diagnostic (never logs tokens/keys). */
export async function bootAuth(): Promise<AuthState> {
  const mode = authModeFor(location.origin, location.hostname);
  try {
    const c = getClient();
    if (c === null) return { mode, agent: null, did: null, who: null };
    const result = await c.init();
    if (result === undefined) return { mode, agent: null, did: null, who: null };
    currentSession = result.session;
    const agent = new Agent(result.session);
    return {
      mode,
      agent,
      did: result.session.did,
      who: await resolveWho(agent, result.session.did),
    };
  } catch (err) {
    console.error('greetings: OAuth restore/callback failed', err);
    return { mode, agent: null, did: null, who: null };
  }
}

/** Best-effort handle for display; falls back to the DID. */
async function resolveWho(agent: Agent, did: string): Promise<string> {
  try {
    const res = await agent.com.atproto.repo.describeRepo({ repo: did });
    return res.data.handle ?? did;
  } catch {
    return did;
  }
}

/** Options for a sign-in start (croft-pwa/docs/DESIGN.md § Flows › Sign in). */
export type SignInOptions = {
  /** `create` lands the person in the provider's registration wizard, not its sign-in screen. */
  readonly prompt?: 'create';
};

// The hermetic e2e replaces the seam on window before boot: the real signIn
// redirects away, and a test that leaves the app can prove nothing about the
// intent it carried. Checked at call time so the hook can never be baked in.
type SignInHook = (target: string, options?: SignInOptions) => Promise<void>;
function testHook(): SignInHook | null {
  const hook = (window as unknown as { __greetingsSignIn?: unknown }).__greetingsSignIn;
  return typeof hook === 'function' ? (hook as SignInHook) : null;
}

/**
 * Begin the interactive sign-in redirect (resolves only on failure/abort).
 * `target` is a handle (identity first) or a provider ENTRYWAY such as
 * `https://bsky.social` (server first — the official client accepts either;
 * forage drives the same call). Options are forwarded verbatim: an options-less
 * call must not invent a prompt.
 */
export async function signIn(target: string, options?: SignInOptions): Promise<void> {
  const hook = testHook();
  if (hook !== null) return hook(target, options);
  const c = getClient();
  if (c === null) throw new Error('sign-in is not available on this origin');
  await (options === undefined ? c.signIn(target) : c.signIn(target, options));
}

/** Revoke the restored session. No-op when signed out. */
export async function signOut(): Promise<void> {
  if (currentSession === null) return;
  await currentSession.signOut();
  currentSession = null;
}
