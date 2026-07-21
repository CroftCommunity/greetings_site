import { describe, it, expect } from 'vitest';
import {
  PRODUCTION_ORIGIN,
  authModeFor,
  isLoopbackHostname,
  normalizeHandle,
  isOAuthCallback,
} from '../../src/auth-core';

// Pure auth logic, browser-free so it unit-tests headless. The interactive OAuth
// round-trip (redirect + consent) is verified in a browser; these cover the
// decisions the app makes around it.
describe('authModeFor', () => {
  it('is loopback on local hostnames regardless of origin', () => {
    expect(authModeFor('http://127.0.0.1:4173', '127.0.0.1')).toBe('loopback');
    expect(authModeFor('http://localhost:4173', 'localhost')).toBe('loopback');
  });
  it('is hosted only on the exact production origin', () => {
    expect(authModeFor(PRODUCTION_ORIGIN, 'greetings.croft.ing')).toBe('hosted');
  });
  it('is none on any other origin (e.g. a PR preview) — degrade to read-only', () => {
    expect(authModeFor('https://example.com', 'example.com')).toBe('none');
    expect(authModeFor('https://greetings.croft.ing.evil.test', 'greetings.croft.ing.evil.test')).toBe('none');
  });
});

describe('isLoopbackHostname', () => {
  it('matches the three loopback forms and nothing else', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('[::1]')).toBe(true);
    expect(isLoopbackHostname('greetings.croft.ing')).toBe(false);
  });
});

describe('normalizeHandle', () => {
  it('trims, strips leading @, and lowercases', () => {
    expect(normalizeHandle('  @Alice.BSKY.social ')).toBe('alice.bsky.social');
    expect(normalizeHandle('bob.test')).toBe('bob.test');
    expect(normalizeHandle('@@carol.test')).toBe('carol.test');
  });
  it('returns empty for blank input', () => {
    expect(normalizeHandle('   ')).toBe('');
  });
});

describe('isOAuthCallback', () => {
  it('is true only when both code and state are present', () => {
    expect(isOAuthCallback('?code=abc&state=xyz')).toBe(true);
    expect(isOAuthCallback('?code=abc')).toBe(false);
    expect(isOAuthCallback('?state=xyz')).toBe(false);
    expect(isOAuthCallback('')).toBe(false);
  });
});
