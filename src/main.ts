// greetings.croft.ing — app entry (Phase 2).
//
// Wires the pure router to the view shells and boots creator OAuth: on load it
// restores an existing session or completes an OAuth callback, then re-renders
// with the auth state. The card create/view flows (Phases 3–4) build on the
// authenticated agent this establishes.
import { parseHash, type Route } from './router';
import { authModeFor, isOAuthCallback } from './auth-core';
import { bootAuth, signIn, signOut, type AuthState } from './auth';
import { renderHome } from './views/home';
import { renderCreate, type CreateAuthView, type CreateHandlers } from './views/create';
import { renderCard, renderNotFound } from './views/card';

let auth: AuthState = {
  mode: authModeFor(location.origin, location.hostname),
  agent: null,
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
          auth = { ...auth, agent: null, who: null };
          rerender();
        });
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
