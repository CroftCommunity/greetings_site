import { describe, it, expect } from 'vitest';
import {
  genKey,
  exportKeyB64url,
  importKeyB64url,
  seal,
  open,
  sealCoverBytes,
  openCoverBytes,
  keyFromHash,
  bytesToB64url,
  b64urlToBytes,
} from '../../src/crypto';

// Promoted from the D1 spike (scratchpad/d1-crypto.mjs) under TDD, per its
// `promote` disposition. AES-256-GCM via WebCrypto; the key lives only in the
// URL fragment (never networked), the record stores {iv, ct}.

describe('base64url', () => {
  it('round-trips arbitrary bytes', () => {
    const b = new Uint8Array([0, 1, 2, 250, 255, 128]);
    expect(Array.from(b64urlToBytes(bytesToB64url(b)))).toEqual(Array.from(b));
  });
  it('is url-safe (no +, /, =)', () => {
    expect(bytesToB64url(new Uint8Array([251, 255, 254]))).not.toMatch(/[+/=]/);
  });
});

describe('seal / open (AES-256-GCM)', () => {
  it('round-trips a payload through an exported+reimported key (the #k= path)', async () => {
    const key = await genKey();
    const b64 = await exportKeyB64url(key);
    expect(b64).toHaveLength(43); // 32 bytes -> 43 base64url chars
    const sealed = await seal({ text: 'hi', from: 'a', to: 'b' }, key);
    const reimported = await importKeyB64url(b64);
    expect(await open(sealed, reimported)).toEqual({ text: 'hi', from: 'a', to: 'b' });
  });

  it('uses a fresh IV per seal (same payload -> different iv + ct)', async () => {
    const key = await genKey();
    const a = await seal({ text: 'x' }, key);
    const b = await seal({ text: 'x' }, key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('fails to open with the wrong key', async () => {
    const key = await genKey();
    const wrong = await genKey();
    const sealed = await seal({ text: 'secret' }, key);
    await expect(open(sealed, wrong)).rejects.toBeTruthy();
  });

  it('fails to open tampered ciphertext (GCM auth tag)', async () => {
    const key = await genKey();
    const sealed = await seal({ text: 'secret' }, key);
    const ct = b64urlToBytes(sealed.ct);
    ct[0] = (ct[0] ?? 0) ^ 0x01;
    await expect(open({ iv: sealed.iv, ct: bytesToB64url(ct) }, key)).rejects.toBeTruthy();
  });
});

describe('sealCoverBytes / openCoverBytes (cover image)', () => {
  it('round-trips binary bytes with an iv distinct from the payload iv', async () => {
    const key = await genKey();
    const img = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const cover = await sealCoverBytes(img, key);
    const payload = await seal({ text: 'x' }, key);
    expect(cover.iv).not.toBe(payload.iv);
    expect(Array.from(await openCoverBytes(cover.ct, cover.iv, key))).toEqual(Array.from(img));
  });
});

describe('keyFromHash', () => {
  it('extracts the #k= key from a sealed link', () => {
    expect(keyFromHash('#/c/did:plc:x/rkey#k=ABC-123_key')).toBe('ABC-123_key');
  });
  it('returns null for a public link (no key fragment)', () => {
    expect(keyFromHash('#/c/did:plc:x/rkey')).toBeNull();
    expect(keyFromHash('')).toBeNull();
  });
});
