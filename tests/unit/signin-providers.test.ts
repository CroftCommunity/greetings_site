import { describe, it, expect } from 'vitest';
import {
  PROVIDERS, SIGNUP, ATMO_GLOSS, providerById, featuredProviders, otherProviders,
  canCreateAccount, validateProviders, type Provider,
} from '../../src/signin/providers';

// The sign-in providers registry — the workspace pattern (croft-pwa/docs/DESIGN.md
// § Flows › Sign in). Same probed facts as the reference; re-probed live by
// tests/e2e/signin-providers.live.spec.ts.
const open = (id: string): Provider => ({ id, label: id, entryway: `https://${id}.test`, signups: SIGNUP.OPEN });
const invite = (id: string): Provider => ({ id, label: id, entryway: `https://${id}.test`, signups: SIGNUP.INVITE });

describe('providers registry', () => {
  it('passes its own validation and knows the probed postures', () => {
    expect(() => validateProviders(PROVIDERS)).not.toThrow();
    const by = Object.fromEntries(PROVIDERS.map((p) => [p.entryway, p.signups]));
    expect(by['https://bsky.social']).toBe(SIGNUP.OPEN);
    expect(by['https://blacksky.app']).toBe(SIGNUP.OPEN);
    expect(by['https://eurosky.social']).toBe(SIGNUP.OPEN);
    expect(by['https://northsky.social']).toBe(SIGNUP.INVITE);
  });
  it('carries the atmo gloss verbatim', () => {
    expect(ATMO_GLOSS).toBe('A Personal Data Server provider in the open social Atmosphere');
  });
  it('names what it does not know', () => {
    expect(() => providerById('nope')).toThrow(/nope.*bsky/);
  });
  it('splits panels by posture: featured = open (capped at 4), other = invite-only', () => {
    const reg = [open('o1'), invite('i1'), open('o2')];
    expect(featuredProviders(reg).map((p) => p.id)).toEqual(['o1', 'o2']);
    expect(otherProviders(reg).map((p) => p.id)).toEqual(['i1']);
    expect(featuredProviders(['a', 'b', 'c', 'd', 'e'].map(open))).toHaveLength(4);
    const all = [...featuredProviders(), ...otherProviders()].map((p) => p.id).sort();
    expect(all).toEqual(PROVIDERS.map((p) => p.id).sort());
  });
  it('offers Create only where signups are open — both directions', () => {
    expect(canCreateAccount(open('o'))).toBe(true);
    expect(canCreateAccount(invite('i'))).toBe(false);
  });
  it('fails loudly on bad rows', () => {
    expect(() => validateProviders([{ ...open('x'), signups: 'maybe' as never }])).toThrow(/x.*maybe/);
    expect(() => validateProviders([{ ...open('h'), entryway: 'http://h.test' }])).toThrow(/https/);
    expect(() => validateProviders([open('a'), { ...invite('b'), entryway: 'https://a.test' }])).toThrow(/a\.test/);
  });
});
