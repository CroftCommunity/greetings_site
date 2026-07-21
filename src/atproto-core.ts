// Pure atproto/card helpers — no network or SDK, so they unit-test headless.
// The network reads/writes live in ./pds.ts and ./atproto.ts.

/** The greeting-card lexicon NSID (custom; propagates with no pre-registration). */
export const GREETING_NSID = 'ing.croft.greeting.card';

/** An atproto blob reference as embedded verbatim in a record (the uploadBlob response). */
export type BlobRef = {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
};

export type PublicCardInput = {
  text: string;
  createdAt: string;
  theme?: string;
  from?: string;
  to?: string;
  cover?: BlobRef;
};

export type PublicCardRecord = {
  $type: typeof GREETING_NSID;
  mode: 'public';
  text: string;
  createdAt: string;
  theme?: string;
  from?: string;
  to?: string;
  cover?: BlobRef;
};

/** Build the public (plaintext) card record. Optional fields are omitted when
 * blank/absent — never stored as empty or null. */
export function buildPublicCard(input: PublicCardInput): PublicCardRecord {
  return {
    $type: GREETING_NSID,
    mode: 'public',
    text: input.text,
    createdAt: input.createdAt,
    ...(input.theme ? { theme: input.theme } : {}),
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
    ...(input.cover ? { cover: input.cover } : {}),
  };
}

/** The client-side share hash for a card at `at://<did>/…/<rkey>`. Round-trips
 * with the router's `parseHash`. */
export function buildCardHash(did: string, rkey: string): string {
  return `#/c/${did}/${rkey}`;
}

type DidService = { id?: string; type?: string; serviceEndpoint?: string };

/** Extract the atproto PDS endpoint from a DID document, or null. A custom-NSID
 * record is not served by the public appview, so the view path must resolve the
 * DID to its owning PDS and read there directly. */
export function pdsEndpointFromDidDoc(doc: { service?: DidService[] }): string | null {
  const svc = doc.service?.find(
    (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer',
  );
  return svc?.serviceEndpoint ?? null;
}

/** An unauthenticated `com.atproto.sync.getBlob` URL, usable directly as an
 * `<img src>` for a public (plaintext) cover. */
export function getBlobUrl(pds: string, did: string, cid: string): string {
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

export type PublicCardView = {
  text: string;
  theme: string | null;
  from: string | null;
  to: string | null;
  cover: BlobRef | null;
};

function isBlobRef(x: unknown): x is BlobRef {
  return typeof x === 'object' && x !== null && (x as Record<string, unknown>)['$type'] === 'blob';
}

/** Validate + extract a public card record read from a PDS. Throws (fail loud)
 * if it is not a public card with text — the view surfaces that as a broken-link
 * message rather than rendering garbage. */
export function readPublicCard(value: unknown): PublicCardView {
  if (typeof value !== 'object' || value === null) throw new Error('card record is not an object');
  const v = value as Record<string, unknown>;
  if (v['mode'] !== 'public') throw new Error(`expected a public card, got mode=${String(v['mode'])}`);
  if (typeof v['text'] !== 'string') throw new Error('public card is missing its text');
  return {
    text: v['text'],
    theme: typeof v['theme'] === 'string' ? v['theme'] : null,
    from: typeof v['from'] === 'string' ? v['from'] : null,
    to: typeof v['to'] === 'string' ? v['to'] : null,
    cover: isBlobRef(v['cover']) ? v['cover'] : null,
  };
}

/** The CID a cover blob-ref points at (for getBlobUrl). */
export function coverCid(cover: BlobRef): string {
  return cover.ref.$link;
}

// --- Sealed (server-blind link-key) cards (Phase 4) ------------------------

export type SealedCardInput = {
  iv: string;
  ciphertext: string;
  createdAt: string;
  cover?: BlobRef;
  coverIv?: string;
};

export type SealedCardRecord = {
  $type: typeof GREETING_NSID;
  mode: 'sealed';
  iv: string;
  ciphertext: string;
  createdAt: string;
  cover?: BlobRef;
  coverIv?: string;
};

/** Build the sealed card record. No plaintext greeting/sender/recipient fields —
 * `ciphertext` is the AES-GCM of the whole payload; the `cover` blob (when
 * present) holds AES-GCM ciphertext of the image bytes under `coverIv`. */
export function buildSealedCard(input: SealedCardInput): SealedCardRecord {
  return {
    $type: GREETING_NSID,
    mode: 'sealed',
    iv: input.iv,
    ciphertext: input.ciphertext,
    createdAt: input.createdAt,
    ...(input.cover && input.coverIv ? { cover: input.cover, coverIv: input.coverIv } : {}),
  };
}

/** The share hash for a sealed card: the locator plus the key in the fragment.
 * `#/c/<did>/<rkey>#k=<base64url-key>` — the key rides in the fragment only. */
export function buildSealedCardHash(did: string, rkey: string, keyB64url: string): string {
  return `${buildCardHash(did, rkey)}#k=${keyB64url}`;
}

/** The `mode` of a card record, or null if unreadable. Lets the view branch
 * public vs sealed before parsing. */
export function readCardMode(value: unknown): 'public' | 'sealed' | null {
  if (typeof value !== 'object' || value === null) return null;
  const mode = (value as Record<string, unknown>)['mode'];
  return mode === 'public' || mode === 'sealed' ? mode : null;
}

export type SealedCardView = {
  iv: string;
  ciphertext: string;
  cover: BlobRef | null;
  coverIv: string | null;
};

/** Validate + extract a sealed card record. Throws (fail loud) if it is not a
 * sealed card with iv + ciphertext. */
export function readSealedCard(value: unknown): SealedCardView {
  if (typeof value !== 'object' || value === null) throw new Error('card record is not an object');
  const v = value as Record<string, unknown>;
  if (v['mode'] !== 'sealed') throw new Error(`expected a sealed card, got mode=${String(v['mode'])}`);
  if (typeof v['iv'] !== 'string' || typeof v['ciphertext'] !== 'string') {
    throw new Error('sealed card is missing iv/ciphertext');
  }
  const coverIv = typeof v['coverIv'] === 'string' ? v['coverIv'] : null;
  return {
    iv: v['iv'],
    ciphertext: v['ciphertext'],
    cover: isBlobRef(v['cover']) ? v['cover'] : null,
    coverIv,
  };
}
