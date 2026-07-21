// Pure hash router for the greetings SPA. GitHub Pages serves one document
// (index.html); all navigation is client-side via `location.hash`, so no server
// rewrite or 404 fallback is needed (Phase 0 D3). `parseHash` is deliberately
// side-effect-free so it unit-tests without a DOM.

/** A resolved client-side route. */
export type Route =
  | { kind: 'home' }
  | { kind: 'create' }
  | { kind: 'card'; did: string; rkey: string }
  | { kind: 'notfound'; hash: string };

/**
 * Resolve a `location.hash` string to a {@link Route}.
 *
 * A sealed-card link is a single URL fragment of the form
 * `#/c/<did>/<rkey>#k=<base64url-key>`; the key portion (from the `#k=` marker)
 * is stripped before routing so it never affects route resolution. Unknown
 * routes fall back to `home`; a card locator that is present but malformed
 * resolves to `notfound` (a defined state, never a thrown error).
 */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  // Drop the key fragment (Phase 4): everything from the first inner '#'.
  const routePart = raw.split('#')[0] ?? '';
  const path = routePart.replace(/^\/+/, '').replace(/\/+$/, '');

  if (path === '') return { kind: 'home' };

  const segs = path.split('/');
  if (segs.length === 1 && segs[0] === 'create') return { kind: 'create' };

  if (segs[0] === 'c') {
    const did = segs[1];
    const rkey = segs[2];
    if (segs.length === 3 && did && rkey) return { kind: 'card', did, rkey };
    return { kind: 'notfound', hash };
  }

  return { kind: 'home' };
}
