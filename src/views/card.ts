// Card view (Phase 1b shell) + the not-found state for a malformed link. The
// real view path — resolve the DID to its PDS, read the record, render the
// greeting + cover (and decrypt for sealed cards) — arrives in Phases 3–4. This
// shell proves the card route is reachable and surfaces a clear broken-link
// message rather than a blank page (fail loud).
import type { Route } from '../router';

export function renderCard(app: HTMLElement, route: Extract<Route, { kind: 'card' }>): void {
  app.replaceChildren();

  const h = document.createElement('h1');
  h.textContent = 'Greeting card';

  const status = document.createElement('p');
  status.textContent = `Loading card ${route.rkey}…`;

  app.append(h, status);
}

export function renderNotFound(app: HTMLElement): void {
  app.replaceChildren();

  const h = document.createElement('h1');
  h.textContent = 'Card not found';

  const msg = document.createElement('p');
  msg.textContent = 'This card link looks broken. Check that you copied the whole link.';

  const home = document.createElement('a');
  home.href = '#/';
  home.className = 'button';
  home.textContent = 'Go home';

  app.append(h, msg, home);
}
