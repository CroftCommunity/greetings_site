// Card view (Phase 3). Resolves the creator's DID to their PDS, reads the public
// record, and renders the greeting + optional cover — no login. Failures surface
// a plain broken-link message + a console diagnostic naming the leg that failed
// (fail loud, never a blank page). Sealed (server-blind) cards arrive in Phase 4.
import { parseHash, type Route } from '../router';
import { resolveDidToPds } from '../pds.js';
import { getRecordPublic } from '../atproto.js';
import { coverCid, getBlobUrl, readPublicCard, type PublicCardView } from '../atproto-core.js';

type CardRoute = Extract<Route, { kind: 'card' }>;
type LoadedCard = PublicCardView & { pds: string; did: string };

export function renderCard(app: HTMLElement, route: CardRoute): void {
  app.replaceChildren();
  const loading = document.createElement('p');
  loading.textContent = 'Loading card…';
  app.append(loading);

  loadCard(route)
    .then((card) => {
      if (stillViewing(route)) renderLoaded(app, card);
    })
    .catch((err: unknown) => {
      console.error(`greetings: could not load card ${route.did}/${route.rkey}`, err);
      if (stillViewing(route)) renderError(app);
    });
}

async function loadCard(route: CardRoute): Promise<LoadedCard> {
  const pds = await resolveDidToPds(route.did);
  const value = await getRecordPublic(pds, route.did, route.rkey);
  const card = readPublicCard(value);
  return { ...card, pds, did: route.did };
}

/** Guard against a navigation race: only paint if the user is still on this card. */
function stillViewing(route: CardRoute): boolean {
  const now = parseHash(location.hash);
  return now.kind === 'card' && now.did === route.did && now.rkey === route.rkey;
}

function renderLoaded(app: HTMLElement, card: LoadedCard): void {
  app.replaceChildren();

  const heading = document.createElement('h1');
  heading.textContent = card.to ? `A greeting for ${card.to}` : 'A greeting for you';
  app.append(heading);

  const panel = document.createElement('article');
  panel.className = `card card--${card.theme ?? 'plain'}`;

  if (card.cover) {
    const img = document.createElement('img');
    img.className = 'card__cover';
    img.alt = 'cover image';
    img.src = getBlobUrl(card.pds, card.did, coverCid(card.cover));
    panel.append(img);
  }

  const body = document.createElement('p');
  body.className = 'card__text';
  body.textContent = card.text;
  panel.append(body);

  if (card.from) {
    const sig = document.createElement('p');
    sig.className = 'card__from';
    sig.textContent = `— ${card.from}`;
    panel.append(sig);
  }

  app.append(panel, makeOwnLink());
}

function renderError(app: HTMLElement): void {
  app.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'Card unavailable';
  const msg = document.createElement('p');
  msg.textContent =
    'This card could not be loaded — the link may be broken, or the card may have been removed.';
  app.append(h, msg, makeOwnLink());
}

export function renderNotFound(app: HTMLElement): void {
  app.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'Card not found';
  const msg = document.createElement('p');
  msg.textContent = 'This card link looks broken. Check that you copied the whole link.';
  app.append(h, msg, makeOwnLink());
}

function makeOwnLink(): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = '#/create';
  a.className = 'button';
  a.textContent = 'Make your own';
  return a;
}
