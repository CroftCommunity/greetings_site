// greetings.croft.ing — app entry (Phase 1b shell).
//
// Wires the pure router to the view shells: renders on load and on every
// hashchange. Registers the app-shell service worker for installability. Creator
// OAuth (Phase 2) and the card create/view flows (Phases 3–4) build on this.
import { parseHash, type Route } from './router';
import { renderHome } from './views/home';
import { renderCreate } from './views/create';
import { renderCard, renderNotFound } from './views/card';

function render(app: HTMLElement, route: Route): void {
  // Stable marker the e2e wiring test asserts on (which view is live).
  app.dataset['view'] = route.kind;
  switch (route.kind) {
    case 'home':
      return renderHome(app);
    case 'create':
      return renderCreate(app);
    case 'card':
      return renderCard(app, route);
    case 'notfound':
      return renderNotFound(app);
  }
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const route = (): void => render(app, parseHash(location.hash));
  window.addEventListener('hashchange', route);
  route();

  // App-shell PWA. Registration failure is a lost enhancement, not a broken app,
  // so it is logged (diagnostic) but never thrown. The SW never sees the #k= card
  // key: URL fragments are not sent in fetch requests.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err: unknown) => {
        console.error('greetings: service worker registration failed', err);
      });
    });
  }
}

boot();
