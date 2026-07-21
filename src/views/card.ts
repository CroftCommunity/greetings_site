// Card view (Phases 3–4). Resolves the creator's DID to their PDS, reads the
// record, and renders — no login. Public cards render the plaintext + a cover via
// <img src>. Sealed cards take the key from the URL fragment (#k=), decrypt the
// payload in the browser, and render the decrypted greeting + a cover fetched as
// ciphertext bytes -> decrypted -> blob: URL. Failures surface a plain message +
// a console diagnostic (fail loud); the key/plaintext never leave the browser.
import { parseHash, type Route } from '../router';
import { resolveDidToPds } from '../pds.js';
import { getRecordPublic, getBlobBytes } from '../atproto.js';
import {
  coverCid,
  getBlobUrl,
  readCardMode,
  readPublicCard,
  readSealedCard,
} from '../atproto-core.js';
import { importKeyB64url, keyFromHash, open, openCoverBytes } from '../crypto.js';

type CardRoute = Extract<Route, { kind: 'card' }>;
type CardFields = { text: string; theme: string | null; from: string | null; to: string | null };

export function renderCard(app: HTMLElement, route: CardRoute): void {
  app.replaceChildren();
  const loading = document.createElement('p');
  loading.textContent = 'Loading card…';
  app.append(loading);

  loadAndRender(app, route).catch((err: unknown) => {
    console.error(`greetings: could not load card ${route.did}/${route.rkey}`, err);
    if (stillViewing(route)) renderError(app);
  });
}

async function loadAndRender(app: HTMLElement, route: CardRoute): Promise<void> {
  const pds = await resolveDidToPds(route.did);
  const value = await getRecordPublic(pds, route.did, route.rkey);
  const mode = readCardMode(value);

  if (mode === 'public') {
    const card = readPublicCard(value);
    const coverSrc = card.cover ? getBlobUrl(pds, route.did, coverCid(card.cover)) : null;
    if (stillViewing(route)) renderPanel(app, card, coverSrc);
    return;
  }
  if (mode === 'sealed') {
    await renderSealed(app, route, pds, value);
    return;
  }
  throw new Error(`unrecognized card mode: ${String(mode)}`);
}

async function renderSealed(app: HTMLElement, route: CardRoute, pds: string, value: unknown): Promise<void> {
  const keyB64 = keyFromHash(location.hash);
  if (keyB64 === null) {
    if (stillViewing(route)) renderNeedKey(app);
    return;
  }
  const sealed = readSealedCard(value);

  let payload: unknown;
  try {
    const key = await importKeyB64url(keyB64);
    payload = await open({ iv: sealed.iv, ct: sealed.ciphertext }, key);
    const fields = readDecrypted(payload);

    let coverSrc: string | null = null;
    if (sealed.cover && sealed.coverIv) {
      try {
        const ctBytes = await getBlobBytes(pds, route.did, coverCid(sealed.cover));
        const key2 = await importKeyB64url(keyB64);
        const plain = await openCoverBytes(ctBytes, sealed.coverIv, key2);
        coverSrc = URL.createObjectURL(new Blob([plain as BlobPart]));
      } catch (err) {
        console.error('greetings: cover decrypt failed', err); // text still renders
      }
    }
    if (stillViewing(route)) renderPanel(app, fields, coverSrc);
  } catch (err) {
    // Wrong or corrupt key, or a tampered record: distinct from "no key".
    console.error('greetings: could not decrypt this card (wrong key or tampered)', err);
    if (stillViewing(route)) renderNeedKey(app, true);
  }
}

function readDecrypted(payload: unknown): CardFields {
  const p = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
  if (typeof p['text'] !== 'string') throw new Error('decrypted payload has no text');
  return {
    text: p['text'],
    theme: typeof p['theme'] === 'string' ? p['theme'] : null,
    from: typeof p['from'] === 'string' ? p['from'] : null,
    to: typeof p['to'] === 'string' ? p['to'] : null,
  };
}

/** Guard against a navigation race: only paint if still on this card. */
function stillViewing(route: CardRoute): boolean {
  const now = parseHash(location.hash);
  return now.kind === 'card' && now.did === route.did && now.rkey === route.rkey;
}

function renderPanel(app: HTMLElement, fields: CardFields, coverSrc: string | null): void {
  app.replaceChildren();

  const heading = document.createElement('h1');
  heading.textContent = fields.to ? `A greeting for ${fields.to}` : 'A greeting for you';
  app.append(heading);

  const panel = document.createElement('article');
  panel.className = `card card--${fields.theme ?? 'plain'}`;

  if (coverSrc !== null) {
    const img = document.createElement('img');
    img.className = 'card__cover';
    img.alt = 'cover image';
    img.src = coverSrc;
    panel.append(img);
  }

  const body = document.createElement('p');
  body.className = 'card__text';
  body.textContent = fields.text;
  panel.append(body);

  if (fields.from) {
    const sig = document.createElement('p');
    sig.className = 'card__from';
    sig.textContent = `— ${fields.from}`;
    panel.append(sig);
  }

  app.append(panel, makeOwnLink());
}

function renderNeedKey(app: HTMLElement, badKey = false): void {
  app.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'This card is private';
  const msg = document.createElement('p');
  msg.textContent = badKey
    ? 'This card could not be decrypted — the link’s key looks wrong or the card was altered. Ask the sender for the full link again.'
    : 'You need the link’s key to read this card. Ask the sender for the full link — it ends with “#k=…”.';
  app.append(h, msg, makeOwnLink());
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
