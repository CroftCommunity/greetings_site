// greetings.croft.ing — app entry (Phase 2).
//
// Wires the pure router to the view shells and boots creator OAuth: on load it
// restores an existing session or completes an OAuth callback, then re-renders
// with the auth state. The card create/view flows (Phases 3–4) build on the
// authenticated agent this establishes.
import { parseHash, type Route } from './router';
import { authModeFor, isOAuthCallback } from './auth-core';
import { buildPublicCard, buildCardHash, buildSealedCard, buildSealedCardHash } from './atproto-core';
import { uploadBlob, createCard } from './atproto';
import { genKey, exportKeyB64url, seal, sealCoverBytes } from './crypto';
import { bootAuth, signIn, signOut, type AuthState } from './auth';
import { renderHome } from './views/home';
import { renderCreate, type CreateAuthView, type CreateHandlers } from './views/create';
import { renderCard, renderNotFound } from './views/card';

let auth: AuthState = {
  mode: authModeFor(location.origin, location.hostname),
  agent: null,
  did: null,
  who: null,
};

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const createView = (): CreateAuthView => ({
    mode: auth.mode,
    signedIn: auth.agent !== null,
    who: auth.who,
  });

  const rerender = (): void => {
    const route: Route = parseHash(location.hash);
    app.dataset['view'] = route.kind; // stable marker the e2e wiring test asserts on
    switch (route.kind) {
      case 'home':
        renderHome(app);
        break;
      case 'create':
        renderCreate(app, createView(), handlers);
        break;
      case 'card':
        renderCard(app, route);
        break;
      case 'notfound':
        renderNotFound(app);
        break;
    }
  };

  const handlers: CreateHandlers = {
    onSignIn: (handle) => {
      // signIn redirects away on success; it resolves here only on failure/abort.
      signIn(handle).catch((err: unknown) => {
        console.error('greetings: sign-in failed to start', err);
        rerender(); // reset the form (re-enable the button)
      });
    },
    onSignOut: () => {
      signOut()
        .catch((err: unknown) => console.error('greetings: sign-out failed', err))
        .finally(() => {
          auth = { ...auth, agent: null, did: null, who: null };
          rerender();
        });
    },
    onCreatePublic: async ({ text, theme, to, file }) => {
      if (auth.agent === null || auth.did === null) throw new Error('not signed in');
      let cover;
      if (file !== null) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        cover = await uploadBlob(auth.agent, bytes, file.type === '' ? 'application/octet-stream' : file.type);
      }
      const record = buildPublicCard({
        text,
        createdAt: new Date().toISOString(),
        ...(theme && theme !== 'plain' ? { theme } : {}),
        ...(auth.who ? { from: auth.who } : {}),
        ...(to ? { to } : {}),
        ...(cover ? { cover } : {}),
      });
      const { rkey } = await createCard(auth.agent, auth.did, record);
      return new URL(buildCardHash(auth.did, rkey), `${location.origin}${location.pathname}`).toString();
    },
    onCreateSealed: async ({ text, theme, to, file }) => {
      if (auth.agent === null || auth.did === null) throw new Error('not signed in');
      // Encrypt client-side: one fresh key per card; the record stores ciphertext
      // only; the key rides in the returned link's #k= fragment (never networked).
      const key = await genKey();
      const payload = {
        text,
        ...(theme && theme !== 'plain' ? { theme } : {}),
        ...(auth.who ? { from: auth.who } : {}),
        ...(to ? { to } : {}),
      };
      const sealedPayload = await seal(payload, key);
      let cover;
      let coverIv;
      if (file !== null) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sealedCover = await sealCoverBytes(bytes, key);
        cover = await uploadBlob(auth.agent, sealedCover.ct, 'application/octet-stream'); // ciphertext bytes
        coverIv = sealedCover.iv;
      }
      const record = buildSealedCard({
        iv: sealedPayload.iv,
        ciphertext: sealedPayload.ct,
        createdAt: new Date().toISOString(),
        ...(cover && coverIv ? { cover, coverIv } : {}),
      });
      const { rkey } = await createCard(auth.agent, auth.did, record);
      const keyB64 = await exportKeyB64url(key);
      return new URL(
        buildSealedCardHash(auth.did, rkey, keyB64),
        `${location.origin}${location.pathname}`,
      ).toString();
    },
  };

  window.addEventListener('hashchange', rerender);

  // An OAuth callback lands at the origin root with ?code&state; route it to the
  // create view so the completing session shows where sign-in began.
  if (isOAuthCallback(location.search) && location.hash === '') {
    location.hash = '#/create';
  }

  rerender(); // initial paint (pre-auth)
  auth = await bootAuth(); // restore session / complete callback (never throws)
  rerender(); // repaint with auth state

  // App-shell PWA. Registration failure is a lost enhancement, not a broken app,
  // so it is logged but never thrown. The SW never sees the #k= card key.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err: unknown) => {
        console.error('greetings: service worker registration failed', err);
      });
    });
  }
}

boot();
