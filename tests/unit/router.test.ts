import { describe, it, expect } from 'vitest';
import { parseHash } from '../../src/router';

// The router is a pure `location.hash -> Route` function. These assertions name
// the branch edges (not a single happy-path point) so a one-line mutation to the
// parser is caught: home fallback, the create route, a well-formed card locator,
// the #k= key-fragment strip (Phase 4 links), malformed locators, and unknown
// routes.
describe('parseHash', () => {
  it('routes empty / bare / root hash to home', () => {
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#')).toEqual({ kind: 'home' });
    expect(parseHash('#/')).toEqual({ kind: 'home' });
  });

  it('routes #/create to the create view', () => {
    expect(parseHash('#/create')).toEqual({ kind: 'create' });
  });

  it('routes a well-formed card locator to card, parsing did + rkey', () => {
    expect(parseHash('#/c/did:plc:abc123/3kxyz')).toEqual({
      kind: 'card',
      did: 'did:plc:abc123',
      rkey: '3kxyz',
    });
  });

  it('ignores the #k= key fragment when routing a sealed-card link', () => {
    // A sealed link is a single URL fragment: `#/c/<did>/<rkey>#k=<key>`. The
    // router must resolve the route and never let the key affect routing.
    expect(parseHash('#/c/did:plc:abc123/3kxyz#k=Zm9vYmFyStub')).toEqual({
      kind: 'card',
      did: 'did:plc:abc123',
      rkey: '3kxyz',
    });
  });

  it('returns notfound (a defined state, not an exception) for a malformed card locator', () => {
    expect(parseHash('#/c/')).toEqual({ kind: 'notfound', hash: '#/c/' });
    expect(parseHash('#/c/did:plc:only')).toEqual({ kind: 'notfound', hash: '#/c/did:plc:only' });
  });

  it('falls back to home for an unknown route rather than crashing', () => {
    expect(parseHash('#/bogus')).toEqual({ kind: 'home' });
    expect(parseHash('#/create/extra')).toEqual({ kind: 'home' });
  });
});
