import { describe, it, expect } from 'vitest';
import { genKey, exportKeyB64url, importKeyB64url, seal, open, keyFromHash } from '../../src/crypto';
import { buildSealedCard, buildSealedCardHash, readSealedCard } from '../../src/atproto-core';
import { parseHash } from '../../src/router';

// End-to-end (no network): seal a payload, build the exact stored record + share
// link the app produces, then walk the recipient's path — parse the locator,
// pull the key from the fragment, read the record, decrypt. Proves the pieces
// compose and that the stored record leaks no plaintext and is useless without
// the key.
describe('sealed card round-trip (create -> link -> read)', () => {
  const did = 'did:plc:creator';
  const rkey = '3kabc';
  const payload = { text: 'See you Saturday', from: 'alice.bsky.social', to: 'Bob', theme: 'meadow' };

  it('round-trips create -> #k= link -> decrypt with the fragment key', async () => {
    // Creator side.
    const key = await genKey();
    const sealed = await seal(payload, key);
    const record = buildSealedCard({ iv: sealed.iv, ciphertext: sealed.ct, createdAt: 'now' });
    const link = buildSealedCardHash(did, rkey, await exportKeyB64url(key));

    // The stored record carries no plaintext.
    expect(JSON.stringify(record)).not.toContain('See you Saturday');
    expect(JSON.stringify(record)).not.toContain('alice.bsky.social');
    expect(record.mode).toBe('sealed');

    // Recipient side: locator routes; key comes from the fragment.
    expect(parseHash(link)).toEqual({ kind: 'card', did, rkey });
    const keyB64 = keyFromHash(link);
    expect(keyB64).not.toBeNull();
    const view = readSealedCard(record);
    const opened = await open({ iv: view.iv, ct: view.ciphertext }, await importKeyB64url(keyB64 as string));
    expect(opened).toEqual(payload);
  });

  it('cannot be read without the key (a public-style locator yields no key)', async () => {
    const key = await genKey();
    const sealed = await seal(payload, key);
    const record = buildSealedCard({ iv: sealed.iv, ciphertext: sealed.ct, createdAt: 'now' });
    // The recipient has the locator but not the #k= fragment.
    const keylessLocator = `#/c/${did}/${rkey}`;
    expect(keyFromHash(keylessLocator)).toBeNull();
    // And a wrong key fails to open (GCM auth).
    const wrong = await genKey();
    const view = readSealedCard(record);
    await expect(open({ iv: view.iv, ct: view.ciphertext }, wrong)).rejects.toBeTruthy();
  });
});
