/**
 * OIL2 — Microsoft Clarity Bridge Tests
 * @see TESTS.md §6 (clarity: T01–T09)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushClarityConsent } from '../../src/bridges/clarity';
import { mockClarity, cleanup } from '../helpers';
import type { ConsentChoices, OIL2Config } from '../../src/core/types';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const C_TRUE: ConsentChoices = { functional: true, analytics: true, marketing: true };
const C_FALSE: ConsentChoices = { functional: false, analytics: false, marketing: false };

function cfg(category: 'marketing' | 'analytics' = 'marketing'): OIL2Config {
  return { clarity: { category } } as OIL2Config;
}

/** Letztes consentv2-Argument-Objekt aus dem Clarity-Mock. */
function lastConsent(clarity: ReturnType<typeof mockClarity>): Record<string, string> {
  const call = clarity.mock.calls[clarity.mock.calls.length - 1];
  return call[1] as Record<string, string>;
}

describe('pushClarityConsent', () => {
  it('T01: ruft clarity(consentv2, {...}) auf', () => {
    const clarity = mockClarity();
    pushClarityConsent(C_TRUE, cfg());
    expect(clarity).toHaveBeenCalledWith('consentv2', expect.any(Object));
  });

  it('T02: CamelCase korrekt: ad_Storage (großes S)', () => {
    const clarity = mockClarity();
    pushClarityConsent(C_TRUE, cfg());
    const obj = lastConsent(clarity);
    expect(Object.keys(obj)).toContain('ad_Storage');
    expect(Object.keys(obj)).not.toContain('ad_storage'); // kleines s = falsch
  });

  it('T03: CamelCase korrekt: analytics_Storage (großes S)', () => {
    const clarity = mockClarity();
    pushClarityConsent(C_TRUE, cfg());
    const obj = lastConsent(clarity);
    expect(Object.keys(obj)).toContain('analytics_Storage');
    expect(Object.keys(obj)).not.toContain('analytics_storage');
  });

  it('T04: category=marketing → analytics_Storage hängt an marketing-Consent', () => {
    const clarity = mockClarity();
    // marketing=false, analytics=true → analytics_Storage soll denied sein (folgt marketing)
    pushClarityConsent({ functional: false, analytics: true, marketing: false }, cfg('marketing'));
    expect(lastConsent(clarity).analytics_Storage).toBe('denied');
  });

  it('T05: category=analytics → analytics_Storage hängt an analytics-Consent', () => {
    const clarity = mockClarity();
    // marketing=false, analytics=true → analytics_Storage soll granted sein (folgt analytics)
    pushClarityConsent({ functional: false, analytics: true, marketing: false }, cfg('analytics'));
    expect(lastConsent(clarity).analytics_Storage).toBe('granted');
  });

  it('T06: marketing:true → ad_Storage:granted', () => {
    const clarity = mockClarity();
    pushClarityConsent({ ...C_FALSE, marketing: true }, cfg());
    expect(lastConsent(clarity).ad_Storage).toBe('granted');
  });

  it('T07: marketing:false → ad_Storage:denied', () => {
    const clarity = mockClarity();
    pushClarityConsent({ ...C_TRUE, marketing: false }, cfg());
    expect(lastConsent(clarity).ad_Storage).toBe('denied');
  });

  it('T08: clarity nicht geladen → console.warn, kein Crash', () => {
    expect(() => pushClarityConsent(C_TRUE, cfg())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Clarity not loaded'));
  });

  it('T09: clarity existiert, ist aber keine Funktion → graceful', () => {
    (window as unknown as { clarity: unknown }).clarity = { not: 'a function' };
    expect(() => pushClarityConsent(C_TRUE, cfg())).not.toThrow();
  });
});
