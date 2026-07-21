// atproto reads/writes (Phase 3). Reads are unauthenticated public fetches (no
// session needed — the recipient never logs in); writes go through the creator's
// authenticated Agent. Blob-ref handling follows the confirmed uploadBlob ->
// embed-response -> createRecord pattern (Phase 0 D4).
import type { Agent } from '@atproto/api';
import { GREETING_NSID, getBlobUrl, type BlobRef } from './atproto-core.js';

/** Unauthenticated read of a card record's value from the owning PDS. */
export async function getRecordPublic(pds: string, did: string, rkey: string): Promise<unknown> {
  const url =
    `${pds}/xrpc/com.atproto.repo.getRecord` +
    `?repo=${encodeURIComponent(did)}` +
    `&collection=${encodeURIComponent(GREETING_NSID)}` +
    `&rkey=${encodeURIComponent(rkey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getRecord returned ${res.status}`);
  const body = (await res.json()) as { value?: unknown };
  return body.value;
}

/** Fetch a blob's raw bytes (unauthenticated). Used for a sealed cover, whose
 * bytes are ciphertext and must be decrypted before rendering — so they cannot
 * go through an `<img src>` like a public cover. */
export async function getBlobBytes(pds: string, did: string, cid: string): Promise<Uint8Array> {
  const res = await fetch(getBlobUrl(pds, did, cid));
  if (!res.ok) throw new Error(`getBlob returned ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Upload cover bytes and return the blob-ref to embed verbatim in a record.
 * Returns the SDK's BlobRef instance (createRecord serializes it correctly); the
 * cast bridges it to the structural type the record builder expects. */
export async function uploadBlob(agent: Agent, bytes: Uint8Array, mimeType: string): Promise<BlobRef> {
  const res = await agent.uploadBlob(bytes, { encoding: mimeType });
  return res.data.blob as unknown as BlobRef;
}

/** Create a card record in the creator's repo; returns the new rkey + at:// uri. */
export async function createCard(
  agent: Agent,
  did: string,
  record: Record<string, unknown>,
): Promise<{ rkey: string; uri: string }> {
  const res = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: GREETING_NSID,
    record,
  });
  const uri = res.data.uri; // at://<did>/<collection>/<rkey>
  const rkey = uri.split('/').pop() ?? '';
  if (rkey === '') throw new Error(`createRecord returned an unexpected uri: ${uri}`);
  return { rkey, uri };
}
