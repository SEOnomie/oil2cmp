/**
 * OIL2 — Google Consent Mode v2 Bridge Tests
 * @see TESTS.md §6 (gcm: T01–T14)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushGoogleConsent, buildGoogleConsentState } from '../../src/bridges/gcm';
import { mockDataLayer, cleanup } from '../helpers';
import type { OIL2Config, ConsentChoices } from '../../src/core/types';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

// -- Helpers ----------------------------------------------------------------

const C_TRUE: ConsentChoices = { functional: true, analytics: true, marketing: true };
const C_FALSE: ConsentChoices = { functional: false, analytics: false, marketing: false };

function cfg(google: Partial<OIL2Config['google']> = {}): OIL2Config {
  return { google: { urlPassthrough: false, adsDataRedaction: false, ...google } } as OIL2Config;
}

/** Normalisiert einen dataLayer-Eintrag (arguments-Objekt) zu einem Array. */
function asArgs(entry: unknown): unknown[] {
  return Array.from(entry as ArrayLike<unknown>);
}

/** Findet ein gtag('consent','update', …) im dataLayer. */
function findConsentUpdate(dl: unknown[]): Record<string, string> | undefined {
  for (const e of dl) {
    const a = asArgs(e);
    if (a[0] === 'consent' && a[1] === 'update') return a[2] as Record<string, string>;
  }
  return undefined;
}

/** Findet ein gtag('set', key, value) im dataLayer. */
function findSet(dl: unknown[], key: string): unknown[] | undefined {
  for (const e of dl) {
    const a = asArgs(e);
    if (a[0] === 'set' && a[1] === key) return a;
  }
  return undefined;
}

// ===========================================================================

describe('pushGoogleConsent', () => {
  it('T01: pusht consent update mit 7 Signalen', () => {
    const dl = mockDataLayer();
    pushGoogleConsent(C_TRUE, cfg());
    const state = findConsentUpdate(dl);
    expect(state).toBeDefined();
    expect(Object.keys(state!)).toHaveLength(7);
  });

  it('T02: analytics:true → analytics_storage:granted', () => {
    const dl = mockDataLayer();
    pushGoogleConsent({ ...C_FALSE, analytics: true }, cfg());
    expect(findConsentUpdate(dl)!.analytics_storage).toBe('granted');
  });

  it('T03: analytics:false → analytics_storage:denied', () => {
    const dl = mockDataLayer();
    pushGoogleConsent({ ...C_TRUE, analytics: false }, cfg());
    expect(findConsentUpdate(dl)!.analytics_storage).toBe('denied');
  });

  it('T04: marketing:true → ad_storage/ad_user_data/ad_personalization granted', () => {
    const dl = mockDataLayer();
    pushGoogleConsent({ ...C_FALSE, marketing: true }, cfg());
    const s = findConsentUpdate(dl)!;
    expect(s.ad_storage).toBe('granted');
    expect(s.ad_user_data).toBe('granted');
    expect(s.ad_personalization).toBe('granted');
  });

  it('T05: marketing:false → ad_* alle denied', () => {
    const dl = mockDataLayer();
    pushGoogleConsent({ ...C_TRUE, marketing: false }, cfg());
    const s = findConsentUpdate(dl)!;
    expect(s.ad_storage).toBe('denied');
    expect(s.ad_user_data).toBe('denied');
    expect(s.ad_personalization).toBe('denied');
  });

  it('T06: functional:true → functionality_storage/personalization_storage granted', () => {
    const dl = mockDataLayer();
    pushGoogleConsent({ ...C_FALSE, functional: true }, cfg());
    const s = findConsentUpdate(dl)!;
    expect(s.functionality_storage).toBe('granted');
    expect(s.personalization_storage).toBe('granted');
  });

  it('T07: security_storage immer granted', () => {
    const dl = mockDataLayer();
    pushGoogleConsent(C_FALSE, cfg());
    expect(findConsentUpdate(dl)!.security_storage).toBe('granted');
  });

  it('T08: urlPassthrough:true → gtag set url_passthrough true', () => {
    const dl = mockDataLayer();
    pushGoogleConsent(C_TRUE, cfg({ urlPassthrough: true }));
    const set = findSet(dl, 'url_passthrough');
    expect(set).toBeDefined();
    expect(set![2]).toBe(true);
  });

  it('T09: urlPassthrough:false → kein url_passthrough', () => {
    const dl = mockDataLayer();
    pushGoogleConsent(C_TRUE, cfg({ urlPassthrough: false }));
    expect(findSet(dl, 'url_passthrough')).toBeUndefined();
  });

  it('T10: adsDataRedaction:true → gtag set ads_data_redaction true', () => {
    const dl = mockDataLayer();
    pushGoogleConsent(C_TRUE, cfg({ adsDataRedaction: true }));
    const set = findSet(dl, 'ads_data_redaction');
    expect(set).toBeDefined();
    expect(set![2]).toBe(true);
  });

  it('T11: dataLayer existiert nicht → console.warn, kein Crash', () => {
    expect(() => pushGoogleConsent(C_TRUE, cfg())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dataLayer not found'));
  });
});

describe('buildGoogleConsentState', () => {
  it('T12: alle true → alle granted (security immer granted)', () => {
    const s = buildGoogleConsentState(C_TRUE);
    expect(Object.values(s).every((v) => v === 'granted')).toBe(true);
  });

  it('T13: alle false → alle denied außer security', () => {
    const s = buildGoogleConsentState(C_FALSE);
    expect(s.security_storage).toBe('granted');
    expect(s.analytics_storage).toBe('denied');
    expect(s.ad_storage).toBe('denied');
    expect(s.functionality_storage).toBe('denied');
  });

  it('T14: mixed → korrekte Zuordnung', () => {
    const s = buildGoogleConsentState({ functional: true, analytics: false, marketing: true });
    expect(s.functionality_storage).toBe('granted');
    expect(s.analytics_storage).toBe('denied');
    expect(s.ad_storage).toBe('granted');
  });
});
