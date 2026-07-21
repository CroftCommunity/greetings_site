// DID -> PDS resolution (Phase 3). A custom-NSID record is not served by the
// public appview/CDN, so the view path must resolve the creator's DID to their
// owning PDS and read there directly (Phase 0 D2). did:plc via plc.directory;
// did:web via its .well-known document. Fails loud on an unresolvable DID so the
// view surfaces a broken-link message rather than a blank card.
import { pdsEndpointFromDidDoc } from './atproto-core.js';

const PLC_DIRECTORY = 'https://plc.directory';

async function fetchDidDoc(did: string): Promise<{ service?: unknown[] }> {
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`${PLC_DIRECTORY}/${encodeURIComponent(did)}`);
    if (!res.ok) throw new Error(`plc.directory returned ${res.status} for ${did}`);
    return (await res.json()) as { service?: unknown[] };
  }
  if (did.startsWith('did:web:')) {
    // did:web:example.com -> https://example.com/.well-known/did.json
    // did:web:example.com:path -> https://example.com/path/did.json
    const rest = decodeURIComponent(did.slice('did:web:'.length));
    const [host, ...segments] = rest.split(':');
    const base = segments.length === 0 ? `https://${host}/.well-known` : `https://${host}/${segments.join('/')}`;
    const res = await fetch(`${base}/did.json`);
    if (!res.ok) throw new Error(`did:web document returned ${res.status} for ${did}`);
    return (await res.json()) as { service?: unknown[] };
  }
  throw new Error(`unsupported DID method: ${did}`);
}

/** Resolve a DID to its atproto PDS endpoint. */
export async function resolveDidToPds(did: string): Promise<string> {
  const doc = await fetchDidDoc(did);
  const pds = pdsEndpointFromDidDoc(doc as { service?: { id?: string; type?: string; serviceEndpoint?: string }[] });
  if (pds === null) throw new Error(`no atproto PDS endpoint in the DID document for ${did}`);
  return pds;
}
