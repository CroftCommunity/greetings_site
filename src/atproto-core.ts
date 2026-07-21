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
