import { describe, it, expect } from 'vitest';
import {
  GREETING_NSID,
  buildPublicCard,
  buildCardHash,
  pdsEndpointFromDidDoc,
  getBlobUrl,
  readPublicCard,
  buildSealedCard,
  buildSealedCardHash,
  readCardMode,
  readSealedCard,
} from '../../src/atproto-core';
import { parseHash } from '../../src/router';
import { keyFromHash } from '../../src/crypto';

describe('buildPublicCard', () => {
  const base = { text: 'Happy birthday', createdAt: '2026-07-21T00:00:00.000Z' };

  it('always sets $type, mode:public, text and createdAt', () => {
    expect(buildPublicCard(base)).toEqual({
      $type: GREETING_NSID,
      mode: 'public',
      text: 'Happy birthday',
      createdAt: '2026-07-21T00:00:00.000Z',
    });
  });

  it('includes theme/from/to/cover only when provided (omitted, not null)', () => {
    const cover = { $type: 'blob' as const, ref: { $link: 'bafycid' }, mimeType: 'image/jpeg', size: 10 };
    const full = buildPublicCard({ ...base, theme: 'confetti', from: 'alice.test', to: 'Bob', cover });
    expect(full.theme).toBe('confetti');
    expect(full.from).toBe('alice.test');
    expect(full.to).toBe('Bob');
    expect(full.cover).toEqual(cover);
    // empty strings are treated as absent, not stored as empty fields
    const bare = buildPublicCard({ ...base, theme: '', from: '', to: '' });
    expect('theme' in bare).toBe(false);
    expect('from' in bare).toBe(false);
    expect('to' in bare).toBe(false);
    expect('cover' in bare).toBe(false);
  });
});

describe('buildCardHash', () => {
  it('builds a hash that parseHash round-trips back to the same did/rkey', () => {
    const hash = buildCardHash('did:plc:abc123', '3kxyz');
    expect(hash).toBe('#/c/did:plc:abc123/3kxyz');
    expect(parseHash(hash)).toEqual({ kind: 'card', did: 'did:plc:abc123', rkey: '3kxyz' });
  });
});

describe('pdsEndpointFromDidDoc', () => {
  const endpoint = 'https://puffball.us-east.host.bsky.network';
  it('extracts the atproto PDS service endpoint (by id or type)', () => {
    expect(
      pdsEndpointFromDidDoc({ service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: endpoint }] }),
    ).toBe(endpoint);
  });
  it('returns null when no PDS service is present', () => {
    expect(pdsEndpointFromDidDoc({ service: [{ id: '#other', type: 'Other', serviceEndpoint: 'x' }] })).toBeNull();
    expect(pdsEndpointFromDidDoc({})).toBeNull();
  });
});

describe('getBlobUrl', () => {
  it('builds an unauthenticated com.atproto.sync.getBlob URL', () => {
    expect(getBlobUrl('https://pds.example', 'did:plc:abc', 'bafycid')).toBe(
      'https://pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aabc&cid=bafycid',
    );
  });
});

describe('readPublicCard', () => {
  const cover = { $type: 'blob', ref: { $link: 'bafycid' }, mimeType: 'image/jpeg', size: 10 };
  it('extracts fields, defaulting absent optionals to null', () => {
    expect(readPublicCard({ mode: 'public', text: 'hi' })).toEqual({
      text: 'hi', theme: null, from: null, to: null, cover: null,
    });
    expect(readPublicCard({ mode: 'public', text: 'hi', theme: 't', from: 'a', to: 'b', cover })).toEqual({
      text: 'hi', theme: 't', from: 'a', to: 'b', cover,
    });
  });
  it('throws (fail loud) on a non-public or malformed record', () => {
    expect(() => readPublicCard({ mode: 'sealed', iv: 'x', ciphertext: 'y' })).toThrow();
    expect(() => readPublicCard({ mode: 'public' })).toThrow(); // no text
    expect(() => readPublicCard(null)).toThrow();
    expect(() => readPublicCard('nope')).toThrow();
  });
});

describe('sealed cards', () => {
  const cover = { $type: 'blob' as const, ref: { $link: 'bafycid' }, mimeType: 'application/octet-stream', size: 20 };

  it('buildSealedCard stores only iv/ciphertext (no plaintext text/from/to)', () => {
    const rec = buildSealedCard({ iv: 'IV', ciphertext: 'CT', createdAt: '2026-07-21T00:00:00.000Z' });
    expect(rec).toEqual({ $type: GREETING_NSID, mode: 'sealed', iv: 'IV', ciphertext: 'CT', createdAt: '2026-07-21T00:00:00.000Z' });
    expect('text' in rec).toBe(false);
    expect('from' in rec).toBe(false);
    expect('to' in rec).toBe(false);
  });

  it('buildSealedCard includes cover + coverIv only when both are present', () => {
    expect(buildSealedCard({ iv: 'IV', ciphertext: 'CT', createdAt: 'now', cover }).cover).toBeUndefined(); // no coverIv
    const withCover = buildSealedCard({ iv: 'IV', ciphertext: 'CT', createdAt: 'now', cover, coverIv: 'CIV' });
    expect(withCover.cover).toEqual(cover);
    expect(withCover.coverIv).toBe('CIV');
  });

  it('buildSealedCardHash puts the key in the fragment; parseHash routes it, keyFromHash extracts it', () => {
    const hash = buildSealedCardHash('did:plc:abc', '3k', 'THEKEY');
    expect(hash).toBe('#/c/did:plc:abc/3k#k=THEKEY');
    expect(parseHash(hash)).toEqual({ kind: 'card', did: 'did:plc:abc', rkey: '3k' }); // key does not affect routing
    expect(keyFromHash(hash)).toBe('THEKEY');
  });

  it('readCardMode distinguishes public / sealed / unreadable', () => {
    expect(readCardMode({ mode: 'public', text: 'x' })).toBe('public');
    expect(readCardMode({ mode: 'sealed', iv: 'a', ciphertext: 'b' })).toBe('sealed');
    expect(readCardMode({ mode: 'other' })).toBeNull();
    expect(readCardMode(null)).toBeNull();
  });

  it('readSealedCard extracts iv/ciphertext (+ cover/coverIv), throws on public', () => {
    expect(readSealedCard({ mode: 'sealed', iv: 'IV', ciphertext: 'CT' })).toEqual({
      iv: 'IV', ciphertext: 'CT', cover: null, coverIv: null,
    });
    expect(readSealedCard({ mode: 'sealed', iv: 'IV', ciphertext: 'CT', cover, coverIv: 'CIV' })).toEqual({
      iv: 'IV', ciphertext: 'CT', cover, coverIv: 'CIV',
    });
    expect(() => readSealedCard({ mode: 'public', text: 'x' })).toThrow();
    expect(() => readSealedCard({ mode: 'sealed' })).toThrow(); // no iv/ciphertext
  });
});
