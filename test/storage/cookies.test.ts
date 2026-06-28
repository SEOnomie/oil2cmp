/**
 * OIL2 — Cookie Storage Tests
 * @see TESTS.md §3 (T01–T27)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readConsent,
  writeConsent,
  deleteConsent,
  encodeCookie,
  decodeCookie,
  choicesToPayload,
  payloadToChoices,
} from '../../src/storage/cookies';
import { setCookie, makeCookiePayload, cleanup } from '../helpers';
import type { CookiePayload, ConsentChoices, OIL2Config } from '../../src/core/types';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

/** Aktiviert einen Spy auf den document.cookie-Setter und gibt das Write-Log zurück. */
function captureCookieWrites(): string[] {
  const writes: string[] = [];
  vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
    writes.push(v as unknown as string);
  });
  return writes;
}

/** Minimal-Config für Write-Tests. */
function makeConfig(overrides?: Partial<OIL2Config['cookie']>, version = 1, ab = 'A'): OIL2Config {
  return {
    _v: version,
    _ab: ab,
    cookie: { name: 'oil2', domain: '', days: 365, sameSite: 'Lax', ...overrides },
  } as OIL2Config;
}

const ALL_TRUE: ConsentChoices = { functional: true, analytics: true, marketing: true };
const ALL_FALSE: ConsentChoices = { functional: false, analytics: false, marketing: false };

// ---------------------------------------------------------------------------

describe('readConsent', () => {
  it('T01: Cookie vorhanden → gibt CookiePayload zurück', () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 0 }));
    const p = readConsent();
    expect(p).not.toBeNull();
    expect(p?.f).toBe(1);
    expect(p?.a).toBe(1);
    expect(p?.m).toBe(0);
  });

  it('T02: Kein Cookie → gibt null zurück', () => {
    expect(readConsent()).toBeNull();
  });

  it('T03: Cookie mit korruptem Base64 → null + console.warn', () => {
    setCookie('oil2', '!!!not-base64!!!');
    expect(readConsent()).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Corrupt'));
  });

  it('T04: valides Base64 aber ungültiges JSON → null', () => {
    setCookie('oil2', btoa('not json {{{'));
    expect(readConsent()).toBeNull();
  });

  it('T05: gültiges JSON, falsche Struktur (f fehlt) → null', () => {
    setCookie('oil2', btoa(JSON.stringify({ a: 1, m: 0, t: 123, v: 1, ab: 'A' })));
    expect(readConsent()).toBeNull();
  });

  it('T06: f=2 (nicht 0 oder 1) → null', () => {
    setCookie('oil2', btoa(JSON.stringify({ f: 2, a: 1, m: 0, t: 123, v: 1, ab: 'A' })));
    expect(readConsent()).toBeNull();
  });

  it('T07: mehrere Cookies, oil2 ist einer davon → findet korrekten Cookie', () => {
    setCookie('foo', 'bar');
    setCookie('oil2', makeCookiePayload({ f: 0, a: 1, m: 1 }));
    setCookie('baz', 'qux');
    const p = readConsent();
    expect(p?.f).toBe(0);
    expect(p?.a).toBe(1);
    expect(p?.m).toBe(1);
  });
});

describe('writeConsent', () => {
  it('T08: schreibt Cookie mit korrektem Format', () => {
    const writes = captureCookieWrites();
    writeConsent(ALL_TRUE, makeConfig());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^oil2=/);
    expect(writes[0]).toContain('path=/');
  });

  it('T09: Cookie enthält Base64-encodierten JSON-Payload', () => {
    const writes = captureCookieWrites();
    writeConsent({ functional: true, analytics: false, marketing: true }, makeConfig());
    const value = writes[0].match(/^oil2=([^;]+)/)![1];
    const decoded = JSON.parse(atob(value)) as CookiePayload;
    expect(decoded.f).toBe(1);
    expect(decoded.a).toBe(0);
    expect(decoded.m).toBe(1);
  });

  it('T10: max-age = config.cookie.days × 86400', () => {
    const writes = captureCookieWrites();
    writeConsent(ALL_TRUE, makeConfig({ days: 30 }));
    expect(writes[0]).toContain('max-age=' + 30 * 86400);
  });

  it('T11: SameSite=Lax gesetzt', () => {
    const writes = captureCookieWrites();
    writeConsent(ALL_TRUE, makeConfig({ sameSite: 'Lax' }));
    expect(writes[0]).toContain('SameSite=Lax');
  });

  it('T12: Secure Flag gesetzt', () => {
    const writes = captureCookieWrites();
    writeConsent(ALL_TRUE, makeConfig());
    expect(writes[0]).toContain('Secure');
  });

  it('T13: Domain wird gesetzt wenn in Config definiert', () => {
    const writes = captureCookieWrites();
    writeConsent(ALL_TRUE, makeConfig({ domain: '.example.de' }));
    expect(writes[0]).toContain('domain=.example.de');
  });

  it('T14: Domain wird nicht gesetzt wenn Config leer', () => {
    const writes = captureCookieWrites();
    writeConsent(ALL_TRUE, makeConfig({ domain: '' }));
    expect(writes[0]).not.toContain('domain=');
  });
});

describe('deleteConsent', () => {
  it('T15: löscht Cookie via max-age=0', () => {
    const writes = captureCookieWrites();
    deleteConsent(makeConfig());
    expect(writes[0]).toContain('max-age=0');
    expect(writes[0]).toMatch(/^oil2=/);
  });

  it('T16: Cookie existiert nicht → kein Error', () => {
    expect(() => deleteConsent(makeConfig())).not.toThrow();
  });
});

describe('encodeCookie / decodeCookie', () => {
  it('T17: Roundtrip encode → decode → identisches Objekt', () => {
    const payload: CookiePayload = { f: 1, a: 0, m: 1, t: 1707744000, v: 3, ab: 'B' };
    const decoded = decodeCookie(encodeCookie(payload));
    expect(decoded).toEqual(payload);
  });

  it('T18: encode produziert gültigen Base64-String', () => {
    const encoded = encodeCookie({ f: 1, a: 1, m: 1, t: 1, v: 1, ab: 'A' });
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(() => atob(encoded)).not.toThrow();
  });

  it('T19: decode mit leerem String → null', () => {
    expect(decodeCookie('')).toBeNull();
  });

  it('T20: decode mit null → null', () => {
    expect(decodeCookie(null as unknown as string)).toBeNull();
  });
});

describe('choicesToPayload / payloadToChoices', () => {
  it('T21: alle true → f=1, a=1, m=1', () => {
    const p = choicesToPayload(ALL_TRUE, makeConfig());
    expect([p.f, p.a, p.m]).toEqual([1, 1, 1]);
  });

  it('T22: alle false → f=0, a=0, m=0', () => {
    const p = choicesToPayload(ALL_FALSE, makeConfig());
    expect([p.f, p.a, p.m]).toEqual([0, 0, 0]);
  });

  it('T23: mixed → korrekte Zuordnung', () => {
    const p = choicesToPayload({ functional: false, analytics: true, marketing: false }, makeConfig());
    expect([p.f, p.a, p.m]).toEqual([0, 1, 0]);
  });

  it('T24: Timestamp wird automatisch gesetzt (±2s)', () => {
    const now = Math.floor(Date.now() / 1000);
    const p = choicesToPayload(ALL_TRUE, makeConfig());
    expect(Math.abs(p.t - now)).toBeLessThanOrEqual(2);
  });

  it('T25: Config-Version aus config._v', () => {
    const p = choicesToPayload(ALL_TRUE, makeConfig({}, 7));
    expect(p.v).toBe(7);
  });

  it('T26: A/B-Variante aus config._ab', () => {
    const p = choicesToPayload(ALL_TRUE, makeConfig({}, 1, 'C'));
    expect(p.ab).toBe('C');
  });

  it('T27: Roundtrip choices → payload → choices → identisch', () => {
    const choices: ConsentChoices = { functional: true, analytics: false, marketing: true };
    const back = payloadToChoices(choicesToPayload(choices, makeConfig()));
    expect(back).toEqual(choices);
  });
});
