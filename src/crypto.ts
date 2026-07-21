// Server-blind card crypto (Phase 4), promoted from the D1 spike under TDD.
// WebCrypto AES-256-GCM: a fresh 256-bit key + fresh 96-bit IV per card. The key
// is exported as base64url and lives ONLY in the URL fragment (#k=), never sent
// to any server; the record stores {iv, ct}. base64url is browser-portable (no
// Node Buffer) so browser and test behave identically.

const subtle = globalThis.crypto.subtle;

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function genKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportKeyB64url(key: CryptoKey): Promise<string> {
  return bytesToB64url(new Uint8Array(await subtle.exportKey('raw', key)));
}

export async function importKeyB64url(b64url: string): Promise<CryptoKey> {
  return subtle.importKey('raw', b64urlToBytes(b64url) as BufferSource, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/** Sealed material as stored/transported: iv + ciphertext, both base64url. */
export type Sealed = { iv: string; ct: string };

async function encryptRaw(key: CryptoKey, data: Uint8Array): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); // 96-bit, fresh per op
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource),
  );
  return { iv, ct };
}

async function decryptRaw(key: CryptoKey, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource),
  );
}

/** Seal a JSON payload → base64url {iv, ct} (stored in the record). */
export async function seal(payload: unknown, key: CryptoKey): Promise<Sealed> {
  const { iv, ct } = await encryptRaw(key, new TextEncoder().encode(JSON.stringify(payload)));
  return { iv: bytesToB64url(iv), ct: bytesToB64url(ct) };
}

/** Open base64url {iv, ct} → the JSON payload. Throws on wrong key / tamper. */
export async function open(sealed: Sealed, key: CryptoKey): Promise<unknown> {
  const pt = await decryptRaw(key, b64urlToBytes(sealed.iv), b64urlToBytes(sealed.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** Seal cover image bytes → {iv (base64url), ct (raw bytes)}. The ciphertext
 * bytes are uploaded as the blob; the iv is stored on the record as coverIv. */
export async function sealCoverBytes(bytes: Uint8Array, key: CryptoKey): Promise<{ iv: string; ct: Uint8Array }> {
  const { iv, ct } = await encryptRaw(key, bytes);
  return { iv: bytesToB64url(iv), ct };
}

/** Open cover ciphertext bytes (fetched from the blob) with the stored coverIv. */
export async function openCoverBytes(ct: Uint8Array, ivB64url: string, key: CryptoKey): Promise<Uint8Array> {
  return decryptRaw(key, b64urlToBytes(ivB64url), ct);
}

/** Extract the `#k=` key from a sealed link fragment, or null for a public link.
 * A sealed link is a single fragment `/c/<did>/<rkey>#k=<key>`; the key is the
 * segment after the inner `#`. */
export function keyFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of raw.split('#').slice(1)) {
    if (part.startsWith('k=')) return part.slice(2);
  }
  return null;
}
